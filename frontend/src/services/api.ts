/**
 * API facade — the ONLY module pages import for data.
 *
 * - Mock mode (default, VITE_API_MODE != 'live'): in-memory backend that
 *   simulates the Phase 4 contract, incl. idempotency, D-007 extension,
 *   token rotation, rate limits and TZ-day analytics.
 * - Live mode: identical function signatures hitting the Spring Boot API
 *   (docs/api/api-contract.md). Swapping = env var, no page changes.
 */
import type {
  AnalyticsQuery,
  AuthResponse,
  Customer,
  CustomerAnalytics,
  CustomerDetail,
  CustomerQuery,
  DeviceReplacementRequest,
  NetworkHealth,
  NetworkSession,
  Package,
  PackageAnalyticsRow,
  PackageInput,
  Paged,
  PageParams,
  Payment,
  PaymentQuery,
  PurchaseInitResponse,
  PurchaseStatusResponse,
  Replacement,
  ReplacementStatus,
  RevenueAnalytics,
  StatsOverview,
  SubscriptionAction,
  SubscriptionAdmin,
  SubscriptionInfo,
  SubscriptionQuery,
  SubscriptionSummary,
  TokenLoginResponse,
} from '@/types';
import { ApiError } from '@/types';
import {
  audit,
  db,
  delay,
  extendSubscription,
  getPackage,
  invalidateSessionsFor,
  nowIso,
  page,
  pushSms,
  reject,
  rotateToken,
  tzDay,
} from './mock/db';
import { setSmsLog } from './mock/smsInbox';
import { clearAuthTokens, request, setAuthTokens } from './http';
import { MOCK_ADMIN } from '@/config/brand';

const MOCK = import.meta.env.VITE_API_MODE !== 'live';

/* ================================================================== */
/* Helpers                                                            */
/* ================================================================== */

const TZ_OFFSET_MS = 3 * 3600_000; // Africa/Dar_es_Salaam = UTC+3, no DST

function tzDayParts(d = new Date()): { y: number; m: number; d: number } {
  const [y, m, dd] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .split('-')
    .map(Number);
  return { y, m, d: dd };
}

function startOfTzDay(daysAgo = 0): Date {
  const p = tzDayParts(new Date(Date.now() - daysAgo * 86400_000));
  return new Date(Date.UTC(p.y, p.m - 1, p.d) - TZ_OFFSET_MS);
}

function startOfWeekTz(): Date {
  const p = tzDayParts();
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); // 0=Sun
  const sinceMonday = (dow + 6) % 7;
  return startOfTzDay(sinceMonday);
}

function startOfMonthTz(): Date {
  const p = tzDayParts();
  return new Date(Date.UTC(p.y, p.m - 1, 1) - TZ_OFFSET_MS);
}

function startOfYearTz(): Date {
  const p = tzDayParts();
  return new Date(Date.UTC(p.y, 0, 1) - TZ_OFFSET_MS);
}

const successPaid = (p: Payment): boolean => p.status === 'SUCCESS' && !!p.paidAt;

function revenueSince(from: Date): number {
  return db.payments
    .filter((p) => successPaid(p) && new Date(p.paidAt!).getTime() >= from.getTime())
    .reduce((sum, p) => sum + p.amountTzs, 0);
}

function activeSubs() {
  const now = Date.now();
  return db.subscriptions.filter(
    (s) => s.status === 'ACTIVE' && new Date(s.endsAt).getTime() > now,
  );
}

function liveSessions() {
  return db.sessions.filter((s) => !s.endedAt);
}

function summarize(sub: SubscriptionAdmin): SubscriptionSummary {
  return {
    id: sub.id,
    packageId: sub.packageId,
    packageName: sub.packageName,
    status: sub.status,
    startsAt: sub.startsAt,
    endsAt: sub.endsAt,
    remainingSeconds: Math.max(
      0,
      Math.floor((new Date(sub.endsAt).getTime() - Date.now()) / 1000),
    ),
  };
}

const PHONE_RE = /^\+255\d{9}$/;

/* ================================================================== */
/* PUBLIC — customer portal                                           */
/* ================================================================== */

export async function listPackages(): Promise<Package[]> {
  if (!MOCK) return delay(request<Package[]>('/packages'), 0);
  const items = db.packages
    .filter((p) => p.status === 'ACTIVE')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return delay(items);
}

export async function createPurchase(input: {
  phone: string;
  packageId: number;
}): Promise<PurchaseInitResponse> {
  if (!MOCK) {
    return delay(request<PurchaseInitResponse>('/purchases', { method: 'POST', body: input }), 0);
  }
  const phone = input.phone.replace(/[\s-]/g, '');
  if (!PHONE_RE.test(phone)) {
    return reject({
      title: 'Invalid phone number',
      status: 400,
      detail: 'Enter a valid Tanzanian mobile number, e.g. +255 712 345 678',
    });
  }
  const pkg = getPackage(input.packageId);
  if (!pkg || pkg.status !== 'ACTIVE') {
    return reject({ title: 'Package unavailable', status: 422, detail: 'This package is not available for purchase.' });
  }

  const purchaseId = `pur_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  db.payments.unshift({
    id: db.nextId++,
    purchaseId,
    customerId: 0, // assigned on success resolution
    phoneE164: phone,
    packageId: pkg.id,
    packageName: pkg.name,
    amountTzs: pkg.priceTzs,
    provider: 'MPESA_DARAJA',
    providerReference: null,
    status: 'PENDING',
    failureReason: null,
    paidAt: null,
    createdAt: nowIso(),
    activatedSubscriptionId: null,
  });
  db.purchases.push({
    purchaseId,
    phone,
    packageId: pkg.id,
    createdAt: Date.now(),
    status: 'PENDING',
    failed: phone.endsWith('0000'), // demo failure hook
    resolvedSubscriptionId: null,
  });

  return delay({
    purchaseId,
    status: 'PENDING' as const,
    package: { name: pkg.name, priceTzs: pkg.priceTzs, durationSeconds: pkg.durationSeconds },
    phone,
    paymentInstructions: 'Approve the M-Pesa prompt on your phone',
  });
}

/** Lazily resolves pending purchases after 4s (simulates Daraja callback). */
function resolvePurchaseIfNeeded(purchaseId: string): void {
  const purchase = db.purchases.find((p) => p.purchaseId === purchaseId);
  if (!purchase || purchase.status === 'RESOLVED') return;
  if (Date.now() - purchase.createdAt < 4000) return;

  purchase.status = 'RESOLVED';
  const payment = db.payments.find((p) => p.purchaseId === purchaseId);
  const pkg = getPackage(purchase.packageId);
  if (!payment || !pkg) return;

  if (purchase.failed) {
    payment.status = 'FAILED';
    payment.failureReason = 'Customer cancelled the M-Pesa prompt';
    return;
  }

  // ---- verified payment: activate (idempotent by construction) ----
  payment.status = 'SUCCESS';
  payment.providerReference = `MP${Date.now().toString().slice(-9)}`;
  payment.paidAt = nowIso();

  let customer = db.customers.find((c) => c.phoneE164 === purchase.phone);
  if (!customer) {
    customer = {
      id: db.nextId++,
      phoneE164: purchase.phone,
      displayName: null,
      status: 'ACTIVE',
      firstSeenAt: nowIso(),
      lastSeenAt: nowIso(),
      activeSubscription: null,
      totalPurchases: 0,
      totalSpentTzs: 0,
      deviceLabel: null,
    };
    db.customers.unshift(customer);
  }
  payment.customerId = customer.id;
  customer.totalPurchases += 1;
  customer.totalSpentTzs += pkg.priceTzs;
  customer.lastSeenAt = nowIso();

  // D-007: extend active subscription (remaining time preserved) else create
  const now = Date.now();
  const existing = db.subscriptions.find(
    (s) => s.customerId === customer!.id && s.status === 'ACTIVE' && new Date(s.endsAt).getTime() > now,
  );
  let sub: SubscriptionAdmin;
  if (existing) {
    extendSubscription(existing.id, pkg.durationSeconds);
    existing.packageId = pkg.id; // latest purchase defines current package limits
    existing.packageName = pkg.name;
    existing.paymentId = payment.id;
    sub = existing;
  } else {
    sub = {
      id: db.nextId++,
      customerId: customer.id,
      phoneE164: customer.phoneE164,
      packageId: pkg.id,
      packageName: pkg.name,
      paymentId: payment.id,
      status: 'ACTIVE',
      startsAt: payment.paidAt!,
      endsAt: new Date(now + pkg.durationSeconds * 1000).toISOString(),
      activatedAt: payment.paidAt!,
      extensionCount: 0,
      deviceLabel: null,
      tokenHint: null,
    };
    db.subscriptions.unshift(sub);
  }

  const token = rotateToken(sub.id, sub.endsAt); // FR-A03: rotates previous token
  payment.activatedSubscriptionId = sub.id;
  purchase.resolvedSubscriptionId = sub.id;
  customer.activeSubscription = summarize(sub);

  // SMS (mock handset inbox) — token exists ONLY here, never in HTTP responses
  pushSms(purchase.phone, 'TOKEN', `Your ${pkg.name} Wi-Fi access token: ${token}. Keep it safe — use it to connect.`);
  pushSms(
    purchase.phone,
    'CONFIRMATION',
    `M-Pesa payment of TZS ${pkg.priceTzs} received. ${pkg.name} active until ${new Date(sub.endsAt).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })}.`,
  );
  setSmsLog([...db.smsLog]);
}

export async function getPurchase(purchaseId: string): Promise<PurchaseStatusResponse> {
  if (!MOCK) {
    return delay(request<PurchaseStatusResponse>(`/purchases/${encodeURIComponent(purchaseId)}`), 0);
  }
  const purchase = db.purchases.find((p) => p.purchaseId === purchaseId);
  if (!purchase) return reject({ title: 'Not found', status: 404, detail: 'Unknown purchase reference.' });
  resolvePurchaseIfNeeded(purchaseId);

  const payment = db.payments.find((p) => p.purchaseId === purchaseId)!;
  let subscription: SubscriptionSummary | null = null;
  if (payment.activatedSubscriptionId) {
    const sub = db.subscriptions.find((s) => s.id === payment.activatedSubscriptionId);
    if (sub) subscription = summarize(sub);
  }
  return delay({
    purchaseId,
    status: payment.status,
    failureReason: payment.failureReason,
    subscription,
  });
}

/* ---------------- token auth core (shared) ---------------- */

interface TokenAuth {
  token: (typeof db.tokens)[number];
  sub: SubscriptionAdmin;
}

function authenticateToken(token: string | undefined, enforceRateLimit: boolean): TokenAuth {
  const raw = (token ?? '').trim();
  if (!raw) throw new ApiError({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Access token required.' });

  if (enforceRateLimit) {
    const key = raw.slice(0, 12);
    const now = Date.now();
    const entry = db.loginAttempts.get(key);
    if (entry && entry.resetAt > now && entry.count >= 5) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new ApiError({
        type: 'about:blank',
        title: 'Too many attempts',
        status: 429,
        detail: `Too many attempts. Try again in ${retryAfter} seconds.`,
      });
    }
    if (!entry || entry.resetAt <= now) db.loginAttempts.set(key, { count: 0, resetAt: now + 60_000 });
    const e = db.loginAttempts.get(key)!;
    e.count += 1;
  }

  const tokenRow = [...db.tokens].reverse().find((t) => t.token === raw);
  if (!tokenRow || tokenRow.status !== 'ACTIVE') {
    throw new ApiError({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Invalid or expired access token.' });
  }
  const sub = db.subscriptions.find((s) => s.id === tokenRow.subscriptionId);
  if (!sub) {
    throw new ApiError({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Invalid or expired access token.' });
  }
  if (sub.status === 'SUSPENDED') {
    throw new ApiError({ type: 'about:blank', title: 'Forbidden', status: 401, detail: 'This subscription is suspended. Please contact support.' });
  }
  if (sub.status !== 'ACTIVE' || new Date(sub.endsAt).getTime() <= Date.now()) {
    throw new ApiError({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Your subscription has expired. Please purchase a new package.' });
  }
  return { token: tokenRow, sub };
}

export async function tokenLogin(input: {
  token: string;
  deviceHint?: string;
}): Promise<TokenLoginResponse> {
  if (!MOCK) {
    return delay(
      request<TokenLoginResponse>('/auth/token-login', { method: 'POST', body: input, token: null }),
      0,
    );
  }
  try {
    const { token, sub } = authenticateToken(input.token, true);
    const hint = input.deviceHint?.trim() || null;

    if (token.deviceHint && hint && token.deviceHint !== hint) {
      throw new ApiError({
        type: 'about:blank',
        title: 'Different device detected',
        status: 409,
        detail: 'This token is bound to another device. Request a device replacement from support.',
      });
    }
    if (!token.deviceHint && hint) {
      token.deviceHint = hint; // first login binds the device (FR-S01)
      token.deviceLabel = null;
      sub.deviceLabel = null;
      const customer = db.customers.find((c) => c.id === sub.customerId);
      if (customer) customer.deviceLabel = null;
    }

    // ensure a live session
    const existing = liveSessions().find((s) => s.subscriptionId === sub.id);
    if (!existing) {
      db.sessions.push({
        grantRef: `grant_${sub.id}`,
        subscriptionId: sub.id,
        ipAddress: `10.10.0.${2 + (sub.id % 240)}`,
        deviceIdentifier: hint ?? `dev_${sub.id}`,
        connectedAt: nowIso(),
        bytesIn: 0,
        bytesOut: 0,
        endedAt: null,
        endReason: null,
      });
    }
    const customer = db.customers.find((c) => c.id === sub.customerId);
    if (customer) customer.lastSeenAt = nowIso();

    return delay<TokenLoginResponse>({
      subscription: summarize(sub),
      session: { state: 'CONNECTED', boundAt: nowIso() },
    });
  } catch (e) {
    if (e instanceof ApiError) return Promise.reject(e);
    throw e;
  }
}

export async function getSubscription(token: string): Promise<SubscriptionInfo> {
  if (!MOCK) {
    return delay(
      request<SubscriptionInfo>('/subscriptions/current', { token: token || null }),
      0,
    );
  }
  const { token: tokenRow, sub } = authenticateToken(token, false);
  const customer = db.customers.find((c) => c.id === sub.customerId);
  return delay({
    customer: { phoneE164: customer?.phoneE164 ?? sub.phoneE164 },
    subscription: summarize(sub),
    device: {
      registered: !!tokenRow.deviceHint,
      deviceLabel: tokenRow.deviceLabel,
      boundAt: tokenRow.deviceHint ? sub.startsAt : null,
    },
  });
}

export async function createDeviceReplacement(input: {
  token: string;
  reason: string;
  newDeviceHint?: string;
}): Promise<DeviceReplacementRequest> {
  if (!MOCK) {
    return delay(
      request<DeviceReplacementRequest>('/device-replacement-requests', {
        method: 'POST',
        body: input,
        token: input.token,
      }),
      0,
    );
  }
  const { sub } = authenticateToken(input.token, false);
  if (input.reason.trim().length < 5) {
    return reject({ title: 'Validation failed', status: 400, detail: 'Please describe your reason (at least 5 characters).' });
  }
  const customer = db.customers.find((c) => c.id === sub.customerId)!;
  const replacement: Replacement = {
    id: db.nextId++,
    customerId: customer.id,
    phoneE164: customer.phoneE164,
    subscriptionId: sub.id,
    reason: input.reason.trim(),
    oldDeviceLabel: customer.deviceLabel,
    newDeviceLabel: null,
    status: 'PENDING',
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: nowIso(),
  };
  db.replacements.unshift(replacement);
  return delay({
    requestId: replacement.id,
    status: 'PENDING' as ReplacementStatus,
    message: 'Your request is pending administrator approval.',
  });
}

/* ================================================================== */
/* ADMIN                                                              */
/* ================================================================== */

export async function adminLogin(email: string, password: string): Promise<AuthResponse> {
  if (!MOCK) {
    const res = await request<AuthResponse>('/admin/auth/login', {
      method: 'POST',
      body: { email, password },
      token: null,
    });
    setAuthTokens(res.accessToken, res.refreshToken);
    return res;
  }
  if (email.trim().toLowerCase() !== MOCK_ADMIN.email || password !== MOCK_ADMIN.password) {
    return reject({ title: 'Invalid credentials', status: 401, detail: 'Email or password is incorrect.' });
  }
  const payload = btoa(JSON.stringify({ sub: MOCK_ADMIN.email, role: 'ADMIN', exp: Date.now() + 900_000 }));
  const res: AuthResponse = {
    accessToken: `mock.${payload}.sig`,
    refreshToken: `mock.refresh.${payload}`,
    expiresIn: 900,
    profile: { id: 1, email: MOCK_ADMIN.email, fullName: MOCK_ADMIN.fullName, role: 'ADMIN' as const },
  };
  // Persist tokens in mock mode too — AuthContext requires an access token
  // alongside the stored profile to consider the admin signed in on reload.
  setAuthTokens(res.accessToken, res.refreshToken);
  return delay(res);
}

export async function adminLogout(): Promise<void> {
  clearAuthTokens();
}

export async function getOverview(_range?: string): Promise<StatsOverview> {
  if (!MOCK) return delay(request<StatsOverview>('/admin/stats/overview'), 0);
  const payments = db.payments;
  return delay({
    revenueToday: revenueSince(startOfTzDay()),
    revenueWeek: revenueSince(startOfWeekTz()),
    revenueMonth: revenueSince(startOfMonthTz()),
    revenueYear: revenueSince(startOfYearTz()),
    revenueTotal: payments.filter(successPaid).reduce((s, p) => s + p.amountTzs, 0),
    activeSubscriptions: activeSubs().length,
    connectedCustomers: liveSessions().length,
    totalPurchases: payments.filter((p) => p.status === 'SUCCESS').length,
    expiredSubscriptions: db.subscriptions.filter((s) => s.status === 'EXPIRED').length,
    failedPayments: payments.filter((p) => p.status === 'FAILED').length,
    pendingPayments: payments.filter((p) => p.status === 'PENDING').length,
    enforcementActive: true,
  });
}

function toCustomer(c: (typeof db.customers)[number]): Customer {
  const sub = db.subscriptions.find(
    (s) => s.customerId === c.id && s.status === 'ACTIVE' && new Date(s.endsAt).getTime() > Date.now(),
  );
  return {
    ...c,
    activeSubscription: sub ? summarize(sub) : null,
    deviceLabel: sub?.deviceLabel ?? c.deviceLabel,
  };
}

export async function listCustomers(q: CustomerQuery = {}): Promise<Paged<Customer>> {
  if (!MOCK) {
    const params = new URLSearchParams();
    if (q.search) params.set('search', q.search);
    if (q.status) params.set('status', q.status);
    params.set('page', String(q.page ?? 1));
    params.set('size', String(q.size ?? 25));
    return delay(request<Paged<Customer>>(`/admin/customers?${params}`), 0);
  }
  const term = q.search?.trim().toLowerCase();
  let items = db.customers.map(toCustomer);
  if (term) items = items.filter((c) => c.phoneE164.includes(term) || (c.displayName ?? '').toLowerCase().includes(term));
  if (q.status) items = items.filter((c) => c.status === q.status);
  items.sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));
  return delay(page(items, q));
}

export async function getCustomer(id: number): Promise<CustomerDetail> {
  if (!MOCK) return delay(request<CustomerDetail>(`/admin/customers/${id}`), 0);
  const c = db.customers.find((x) => x.id === id);
  if (!c) return reject({ title: 'Not found', status: 404, detail: 'Customer not found.' });
  const base = toCustomer(c);
  const subs = db.subscriptions.filter((s) => s.customerId === id);
  const tokenRows = db.tokens.filter((t) => subs.some((s) => s.id === t.subscriptionId) && t.status === 'ACTIVE');
  const device = tokenRows.find((t) => t.deviceHint)
    ? {
        id: id,
        deviceLabel: tokenRows.find((t) => t.deviceHint)!.deviceLabel ?? 'Registered device',
        macHint: null,
        status: 'ACTIVE' as const,
        boundAt: tokenRows.find((t) => t.deviceHint)!.issuedAt,
      }
    : null;
  return delay({
    ...base,
    payments: db.payments.filter((p) => p.customerId === id),
    subscriptions: subs,
    device,
    replacements: db.replacements.filter((r) => r.customerId === id),
  });
}

export async function setCustomerStatus(id: number, status: 'ACTIVE' | 'SUSPENDED'): Promise<void> {
  if (!MOCK) {
    return delay(
      request<void>(`/admin/customers/${id}/${status === 'ACTIVE' ? 'reactivate' : 'suspend'}`, { method: 'POST' }),
      0,
    );
  }
  const c = db.customers.find((x) => x.id === id);
  if (!c) return reject({ title: 'Not found', status: 404, detail: 'Customer not found.' });
  c.status = status;
  const sub = db.subscriptions.find((s) => s.customerId === id && s.status === 'ACTIVE');
  if (status === 'SUSPENDED' && sub) {
    sub.status = 'SUSPENDED';
    sub.deviceLabel = null;
    db.tokens.forEach((t) => {
      if (t.subscriptionId === sub.id && t.status === 'ACTIVE') t.status = 'REVOKED';
    });
    invalidateSessionsFor(sub.id, 'REVOKE');
    c.activeSubscription = null;
  } else if (status === 'ACTIVE' && sub && new Date(sub.endsAt).getTime() > Date.now()) {
    sub.status = 'ACTIVE';
  }
  audit(status === 'SUSPENDED' ? 'CUSTOMER_SUSPEND' : 'CUSTOMER_REACTIVATE', 'customer', id, `${status === 'SUSPENDED' ? 'Suspended' : 'Reactivated'} customer ${c.phoneE164}`);
  return delay(undefined);
}

export async function disconnectCustomer(id: number): Promise<void> {
  if (!MOCK) {
    return delay(request<void>(`/admin/customers/${id}/disconnect`, { method: 'POST' }), 0);
  }
  const c = db.customers.find((x) => x.id === id);
  if (!c) return reject({ title: 'Not found', status: 404, detail: 'Customer not found.' });
  const sub = db.subscriptions.find((s) => s.customerId === id && s.status === 'ACTIVE');
  if (sub) invalidateSessionsFor(sub.id, 'DISCONNECT');
  audit('CUSTOMER_DISCONNECT', 'customer', id, `Disconnected session of customer ${c.phoneE164}`);
  return delay(undefined);
}

/* ---------------- packages ---------------- */

export async function listAdminPackages(): Promise<Package[]> {
  if (!MOCK) return delay(request<Package[]>('/admin/packages'), 0);
  const withCounts = db.packages.map((p) => ({
    ...p,
    activeSubscriberCount: activeSubs().filter((s) => s.packageId === p.id).length,
  }));
  withCounts.sort((a, b) => a.sortOrder - b.sortOrder);
  return delay(withCounts);
}

export async function createPackage(input: PackageInput): Promise<Package> {
  if (!MOCK) return delay(request<Package>('/admin/packages', { method: 'POST', body: input }), 0);
  validatePackage(input);
  const pkg: Package = { id: db.nextId++, ...input };
  db.packages.push(pkg);
  audit('PACKAGE_CREATE', 'package', pkg.id, `Created package "${pkg.name}"`);
  return delay(pkg);
}

export async function updatePackage(id: number, input: PackageInput): Promise<Package> {
  if (!MOCK) return delay(request<Package>(`/admin/packages/${id}`, { method: 'PUT', body: input }), 0);
  const pkg = getPackage(id);
  if (!pkg) return reject({ title: 'Not found', status: 404, detail: 'Package not found.' });
  validatePackage(input);
  const before = pkg.priceTzs;
  Object.assign(pkg, input);
  if (before !== pkg.priceTzs) audit('PACKAGE_UPDATE', 'package', id, `Updated price of "${pkg.name}" from TZS ${before} to TZS ${pkg.priceTzs}`);
  else audit('PACKAGE_UPDATE', 'package', id, `Updated package "${pkg.name}"`);
  return delay(pkg);
}

export async function setPackageStatus(id: number, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
  if (!MOCK) {
    return delay(
      request<void>(`/admin/packages/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, { method: 'POST' }),
      0,
    );
  }
  const pkg = getPackage(id);
  if (!pkg) return reject({ title: 'Not found', status: 404, detail: 'Package not found.' });
  pkg.status = status;
  audit('PACKAGE_STATUS', 'package', id, `${status === 'ACTIVE' ? 'Activated' : 'Deactivated'} package "${pkg.name}"`);
  return delay(undefined);
}

function validatePackage(input: PackageInput): void {
  if (!input.name.trim()) throw new ApiError({ type: 'about:blank', title: 'Validation failed', status: 400, detail: 'Package name is required.' });
  if (!(input.priceTzs > 0)) throw new ApiError({ type: 'about:blank', title: 'Validation failed', status: 400, detail: 'Price must be greater than zero.' });
  if (!(input.durationSeconds > 0)) throw new ApiError({ type: 'about:blank', title: 'Validation failed', status: 400, detail: 'Duration must be greater than zero.' });
  if (input.deviceLimit < 1) throw new ApiError({ type: 'about:blank', title: 'Validation failed', status: 400, detail: 'Device limit must be at least 1.' });
}

/* ---------------- subscriptions ---------------- */

export async function listSubscriptions(q: SubscriptionQuery = {}): Promise<Paged<SubscriptionAdmin>> {
  if (!MOCK) {
    const params = new URLSearchParams();
    if (q.status) params.set('status', q.status);
    if (q.search) params.set('search', q.search);
    if (q.expiringWithinHours) params.set('expiringWithinHours', String(q.expiringWithinHours));
    params.set('page', String(q.page ?? 1));
    params.set('size', String(q.size ?? 25));
    return delay(request<Paged<SubscriptionAdmin>>(`/admin/subscriptions?${params}`), 0);
  }
  let items = [...db.subscriptions];
  if (q.status) items = items.filter((s) => s.status === q.status);
  if (q.search) {
    const t = q.search.trim().toLowerCase();
    items = items.filter((s) => s.phoneE164.includes(t) || s.packageName.toLowerCase().includes(t));
  }
  if (q.expiringWithinHours) {
    const limit = Date.now() + q.expiringWithinHours * 3600_000;
    items = items.filter(
      (s) => s.status === 'ACTIVE' && new Date(s.endsAt).getTime() <= limit && new Date(s.endsAt).getTime() > Date.now(),
    );
  }
  items.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return delay(page(items, q));
}

export async function subscriptionAction(id: number, action: SubscriptionAction): Promise<void> {
  if (!MOCK) {
    return delay(request<void>(`/admin/subscriptions/${id}/${action}`, { method: 'POST' }), 0);
  }
  const sub = db.subscriptions.find((s) => s.id === id);
  if (!sub) return reject({ title: 'Not found', status: 404, detail: 'Subscription not found.' });

  if (action === 'suspend') {
    sub.status = 'SUSPENDED';
    sub.deviceLabel = null;
    db.tokens.forEach((t) => {
      if (t.subscriptionId === id && t.status === 'ACTIVE') t.status = 'REVOKED';
    });
    invalidateSessionsFor(id, 'REVOKE');
    audit('SUBSCRIPTION_SUSPEND', 'subscription', id, `Suspended subscription #${id} (${sub.phoneE164})`);
  } else if (action === 'resume') {
    if (new Date(sub.endsAt).getTime() <= Date.now()) {
      return reject({ title: 'Cannot resume', status: 422, detail: 'Subscription already expired — customer must purchase again.' });
    }
    sub.status = 'ACTIVE';
    audit('SUBSCRIPTION_RESUME', 'subscription', id, `Resumed subscription #${id} (${sub.phoneE164})`);
  } else {
    // revoke: token + access permanently
    sub.status = 'SUSPENDED';
    sub.deviceLabel = null;
    db.tokens.forEach((t) => {
      if (t.subscriptionId === id && t.status === 'ACTIVE') t.status = 'REVOKED';
    });
    invalidateSessionsFor(id, 'REVOKE');
    audit('SUBSCRIPTION_REVOKE', 'subscription', id, `Revoked token for subscription #${id} (${sub.phoneE164})`);
  }
  return delay(undefined);
}

/* ---------------- payments ---------------- */

export async function listPayments(q: PaymentQuery = {}): Promise<Paged<Payment>> {
  if (!MOCK) {
    const params = new URLSearchParams();
    if (q.from) params.set('from', q.from);
    if (q.to) params.set('to', q.to);
    if (q.status) params.set('status', q.status);
    if (q.packageId) params.set('packageId', String(q.packageId));
    if (q.phone) params.set('phone', q.phone);
    params.set('page', String(q.page ?? 1));
    params.set('size', String(q.size ?? 25));
    return delay(request<Paged<Payment>>(`/admin/payments?${params}`), 0);
  }
  const items = filterPayments(q).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(page(items, q));
}

function filterPayments(q: PaymentQuery): Payment[] {
  let items = [...db.payments];
  if (q.from) items = items.filter((p) => !!p.paidAt && tzDay(p.paidAt) >= q.from!);
  if (q.to) items = items.filter((p) => !!p.paidAt && tzDay(p.paidAt) <= q.to!);
  if (q.status) items = items.filter((p) => p.status === q.status);
  if (q.packageId) items = items.filter((p) => p.packageId === Number(q.packageId));
  if (q.phone) {
    const t = q.phone.replace(/\s/g, '');
    items = items.filter((p) => p.phoneE164.includes(t));
  }
  return items;
}

export async function resendToken(paymentId: number): Promise<void> {
  if (!MOCK) {
    return delay(request<void>(`/admin/payments/${paymentId}/resend-token`, { method: 'POST' }), 0);
  }
  const payment = db.payments.find((p) => p.id === paymentId);
  if (!payment) return reject({ title: 'Not found', status: 404, detail: 'Payment not found.' });
  const sub = db.subscriptions.find((s) => s.id === payment.activatedSubscriptionId);
  const tokenRow = sub && db.tokens.find((t) => t.subscriptionId === sub.id && t.status === 'ACTIVE');
  if (!sub || !tokenRow) {
    return reject({ title: 'Token unavailable', status: 409, detail: 'No active token for this purchase — the subscription may be expired or revoked.' });
  }
  pushSms(payment.phoneE164, 'TOKEN', `Your Wi-Fi access token (resend): ${tokenRow.token}`);
  setSmsLog([...db.smsLog]);
  audit('PAYMENT_RESEND_TOKEN', 'payment', payment.id, `Resent access token to ${payment.phoneE164}`);
  return delay(undefined);
}

/* ---------------- device replacements ---------------- */

export async function listReplacements(status?: ReplacementStatus): Promise<Replacement[]> {
  if (!MOCK) {
    const qs = status ? `?status=${status}` : '';
    return delay(request<Replacement[]>(`/admin/device-replacements${qs}`), 0);
  }
  let items = [...db.replacements];
  if (status) items = items.filter((r) => r.status === status);
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return delay(items);
}

export async function reviewReplacement(
  id: number,
  decision: 'APPROVED' | 'REJECTED',
  reason?: string,
): Promise<void> {
  if (!MOCK) {
    return delay(
      request<void>(`/admin/device-replacements/${id}/${decision === 'APPROVED' ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: { reason },
      }),
      0,
    );
  }
  const r = db.replacements.find((x) => x.id === id);
  if (!r) return reject({ title: 'Not found', status: 404, detail: 'Request not found.' });
  if (r.status !== 'PENDING') return reject({ title: 'Already reviewed', status: 409, detail: 'This request was already reviewed.' });

  r.status = decision;
  r.reviewedBy = MOCK_ADMIN.fullName;
  r.reviewedAt = nowIso();
  if (decision === 'REJECTED') r.rejectionReason = reason?.trim() || 'Rejected by administrator';

  const sub = db.subscriptions.find((s) => s.id === r.subscriptionId);
  if (decision === 'APPROVED' && sub) {
    // unbind old device; next token login on the new device re-binds (FR-S03)
    db.tokens.forEach((t) => {
      if (t.subscriptionId === sub.id && t.status === 'ACTIVE') {
        t.deviceHint = null;
        t.deviceLabel = null;
      }
    });
    sub.deviceLabel = null;
    const customer = db.customers.find((c) => c.id === r.customerId);
    if (customer) customer.deviceLabel = null;
    invalidateSessionsFor(sub.id, 'REPLACE');
  }
  audit(
    decision === 'APPROVED' ? 'DEVICE_REPLACEMENT_APPROVE' : 'DEVICE_REPLACEMENT_REJECT',
    'replacement',
    id,
    `${decision === 'APPROVED' ? 'Approved' : 'Rejected'} device replacement for ${r.phoneE164}`,
  );
  return delay(undefined);
}

/* ---------------- network (controller-backed only) ---------------- */

export async function getNetworkHealth(): Promise<NetworkHealth> {
  if (!MOCK) return delay(request<NetworkHealth>('/admin/network/health'), 0);
  return delay({
    enforcementActive: true,
    controller: 'MOCK',
    reachable: true,
    lastSyncAt: new Date(Date.now() - 12_000).toISOString(),
    drift: 0,
  });
}

export async function listNetworkSessions(): Promise<NetworkSession[]> {
  if (!MOCK) return delay(request<NetworkSession[]>('/admin/network/sessions'), 0);
  const items: NetworkSession[] = liveSessions().map((s) => {
    const sub = db.subscriptions.find((x) => x.id === s.subscriptionId);
    const customer = sub && db.customers.find((c) => c.id === sub.customerId);
    return {
      grantRef: s.grantRef,
      ipAddress: s.ipAddress,
      deviceIdentifier: s.deviceIdentifier,
      phoneE164: customer?.phoneE164 ?? sub?.phoneE164 ?? '—',
      subscriptionId: s.subscriptionId,
      packageName: sub?.packageName ?? '—',
      connectedAt: s.connectedAt,
      durationSeconds: Math.floor((Date.now() - new Date(s.connectedAt).getTime()) / 1000),
      bytesIn: s.bytesIn,
      bytesOut: s.bytesOut,
      state: 'CONNECTED',
    };
  });
  return delay(items);
}

export async function disconnectSession(grantRef: string): Promise<void> {
  if (!MOCK) {
    return delay(request<void>(`/admin/network/sessions/${encodeURIComponent(grantRef)}/disconnect`, { method: 'POST' }), 0);
  }
  const s = db.sessions.find((x) => x.grantRef === grantRef && !x.endedAt);
  if (!s) return reject({ title: 'Not found', status: 404, detail: 'Session not found.' });
  s.endedAt = nowIso();
  s.endReason = 'DISCONNECT';
  audit('SESSION_DISCONNECT', 'subscription', s.subscriptionId, `Disconnected session ${grantRef} (${s.ipAddress})`);
  return delay(undefined);
}

/* ---------------- analytics ---------------- */

function paidIn(q: AnalyticsQuery): Payment[] {
  return db.payments.filter(
    (p) => successPaid(p) && p.paidAt && tzDay(p.paidAt) >= q.from && tzDay(p.paidAt) <= q.to,
  );
}

export async function getRevenueAnalytics(q: AnalyticsQuery): Promise<RevenueAnalytics> {
  if (!MOCK) {
    const params = new URLSearchParams({ from: q.from, to: q.to });
    if (q.packageId) params.set('packageId', String(q.packageId));
    if (q.status) params.set('status', q.status);
    return delay(request<RevenueAnalytics>(`/admin/analytics/revenue?${params}`), 0);
  }
  let payments = paidIn(q);
  if (q.packageId) payments = payments.filter((p) => p.packageId === Number(q.packageId));

  // day buckets across the range (TZ days)
  const buckets = new Map<string, { revenueTzs: number; payments: number }>();
  const start = new Date(`${q.from}T00:00:00Z`).getTime();
  const end = new Date(`${q.to}T00:00:00Z`).getTime();
  for (let t = start; t <= end; t += 86400_000) {
    buckets.set(new Date(t).toISOString().slice(0, 10), { revenueTzs: 0, payments: 0 });
  }
  for (const p of payments) {
    const key = tzDay(p.paidAt!);
    const b = buckets.get(key);
    if (b) {
      b.revenueTzs += p.amountTzs;
      b.payments += 1;
    }
  }
  const allInRange = db.payments.filter((p) => p.paidAt && tzDay(p.paidAt) >= q.from && tzDay(p.paidAt) <= q.to);
  const refunded = allInRange.filter((p) => p.status === 'REFUNDED').reduce((s, p) => s + p.amountTzs, 0);
  const revenue = payments.reduce((s, p) => s + p.amountTzs, 0);

  return delay({
    currency: 'TZS',
    buckets: [...buckets.entries()].map(([period, v]) => ({ period, ...v })),
    totals: {
      revenueTzs: revenue,
      payments: payments.length,
      grossTzs: revenue + refunded,
      refundedTzs: refunded,
      profitTzs: null, // expenses not tracked until v1.1 (FR-R05)
    },
  });
}

export async function getPackageAnalytics(q: AnalyticsQuery): Promise<PackageAnalyticsRow[]> {
  if (!MOCK) {
    const params = new URLSearchParams({ from: q.from, to: q.to });
    return delay(request<PackageAnalyticsRow[]>(`/admin/analytics/packages?${params}`), 0);
  }
  const payments = paidIn(q);
  const byPkg = new Map<number, { purchases: number; revenueTzs: number }>();
  for (const p of payments) {
    const cur = byPkg.get(p.packageId) ?? { purchases: 0, revenueTzs: 0 };
    cur.purchases += 1;
    cur.revenueTzs += p.amountTzs;
    byPkg.set(p.packageId, cur);
  }
  const totalRevenue = [...byPkg.values()].reduce((s, v) => s + v.revenueTzs, 0) || 1;
  const rows: PackageAnalyticsRow[] = [...byPkg.entries()].map(([packageId, v]) => ({
    packageId,
    packageName: db.packages.find((p) => p.id === packageId)?.name ?? `Package #${packageId}`,
    purchases: v.purchases,
    revenueTzs: v.revenueTzs,
    sharePercent: Math.round((v.revenueTzs / totalRevenue) * 1000) / 10,
  }));
  rows.sort((a, b) => b.revenueTzs - a.revenueTzs);
  return delay(rows);
}

export async function getCustomerAnalytics(q: AnalyticsQuery): Promise<CustomerAnalytics> {
  if (!MOCK) {
    const params = new URLSearchParams({ from: q.from, to: q.to });
    return delay(request<CustomerAnalytics>(`/admin/analytics/customers?${params}`), 0);
  }
  const buyers = paidIn(q);
  const rangeStart = new Date(`${q.from}T00:00:00Z`).getTime() - TZ_OFFSET_MS;
  const ids = new Set(buyers.map((p) => p.customerId));
  let returning = 0;
  let fresh = 0;
  for (const id of ids) {
    const hadBefore = db.payments.some(
      (p) => p.customerId === id && successPaid(p) && p.paidAt && new Date(p.paidAt).getTime() < rangeStart,
    );
    if (hadBefore) returning += 1;
    else fresh += 1;
  }
  const expired = db.subscriptions.filter((s) => s.status === 'EXPIRED' && new Date(s.endsAt).getTime() >= rangeStart).length;
  return delay({
    newCustomers: fresh,
    returningCustomers: returning,
    returningPercent: ids.size ? Math.round((returning / ids.size) * 100) : 0,
    expiredSubscriptions: expired,
  });
}

export async function exportPaymentsCsv(q: AnalyticsQuery): Promise<string> {
  if (!MOCK) {
    const params = new URLSearchParams({ from: q.from, to: q.to });
    if (q.packageId) params.set('packageId', String(q.packageId));
    return delay(request<string>(`/admin/analytics/export.csv?${params}`), 0);
  }
  const payments = filterPayments({ from: q.from, to: q.to, packageId: q.packageId }).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const header = [
    'Reference', 'Phone', 'Package', 'Amount (TZS)', 'Provider', 'Provider Ref', 'Status', 'Paid At (EAT)', 'Created At (EAT)',
  ];
  const rows = payments.map((p) => [
    p.purchaseId, p.phoneE164, p.packageName, p.amountTzs, p.provider, p.providerReference ?? '',
    p.status, p.paidAt ?? '', p.createdAt,
  ]);
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
}

/* ---------------- audit ---------------- */

export async function listAuditLogs(q: PageParams = {}): Promise<Paged<(typeof db.audits)[number]>> {
  if (!MOCK) {
    const params = new URLSearchParams({ page: String(q.page ?? 1), size: String(q.size ?? 25) });
    return delay(request<Paged<(typeof db.audits)[number]>>(`/admin/audit-logs?${params}`), 0);
  }
  return delay(page(db.audits, q));
}
