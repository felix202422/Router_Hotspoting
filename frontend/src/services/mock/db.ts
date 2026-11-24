/**
 * In-memory mock database (Phase 3 only).
 * Simulates the Phase 4 backend faithfully: idempotency, extension rule (D-007),
 * token rotation, rate limiting, TZ-day analytics. Deterministic via seeded RNG.
 *
 * Real API shapes are defined in src/types (mirror of docs/api/api-contract.md).
 */
import type {
  AuditLog,
  Customer,
  Package,
  Payment,
  Paged,
  Replacement,
  SubscriptionAdmin,
  SubscriptionStatus,
} from '@/types';
import { ApiError } from '@/types';
import { DEMO_TOKEN, MOCK_ADMIN } from '@/config/brand';

/* ---------------- utilities ---------------- */

export function delay<T>(value: T, ms = 250 + Math.random() * 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function reject(problem: {
  title: string;
  status: number;
  detail?: string;
}): Promise<never> {
  const ms = 200 + Math.random() * 250;
  return new Promise((_, rej) =>
    setTimeout(() => rej(new ApiError({ type: 'about:blank', ...problem })), ms),
  );
}

/** Mulberry32 — deterministic seed. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(20261123);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number): number => Math.floor(rand() * (max - min + 1)) + min;

/** Current calendar day in Africa/Dar_es_Salaam (FR-R02). */
export function tzDay(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function nowIso(): string {
  return new Date().toISOString();
}

/* ---------------- seed data ---------------- */

const SEED_PACKAGES: Package[] = [
  { id: 1, name: '1 Hour', description: 'Quick browse & social media', priceTzs: 500, durationSeconds: 3600, dataAllowanceBytes: null, maxDownloadKbps: 5120, maxUploadKbps: 2560, deviceLimit: 1, status: 'ACTIVE', sortOrder: 1 },
  { id: 2, name: '3 Hours', description: 'Study & streaming session', priceTzs: 1000, durationSeconds: 10800, dataAllowanceBytes: null, maxDownloadKbps: 8192, maxUploadKbps: 4096, deviceLimit: 1, status: 'ACTIVE', sortOrder: 2 },
  { id: 3, name: '12 Hours', description: 'Full day of work & fun', priceTzs: 1500, durationSeconds: 43200, dataAllowanceBytes: null, maxDownloadKbps: 10240, maxUploadKbps: 5120, deviceLimit: 1, status: 'ACTIVE', sortOrder: 3 },
  { id: 4, name: '24 Hours', description: 'Unlimited for a full day', priceTzs: 2000, durationSeconds: 86400, dataAllowanceBytes: null, maxDownloadKbps: 10240, maxUploadKbps: 5120, deviceLimit: 1, status: 'ACTIVE', sortOrder: 4 },
  { id: 5, name: '7 Days', description: 'Best value for a week', priceTzs: 8000, durationSeconds: 604800, dataAllowanceBytes: null, maxDownloadKbps: 10240, maxUploadKbps: 5120, deviceLimit: 2, status: 'ACTIVE', sortOrder: 5 },
  { id: 6, name: '30 Days', description: 'Monthly unlimited', priceTzs: 25000, durationSeconds: 2592000, dataAllowanceBytes: null, maxDownloadKbps: 20480, maxUploadKbps: 10240, deviceLimit: 2, status: 'ACTIVE', sortOrder: 6 },
];

const NAMES = [
  'Amina Juma', 'Juma Kessy', 'Neema Mushi', 'Baraka Mwakalinga', 'Rehema Salum',
  'Emmanuel Lyimo', 'Zainabu Ally', 'Frank Mushi', 'Grace Kimaro', 'Joseph Mrema',
  'Halima Yusuf', 'Peter Massawe', 'Neema Shirima', 'Daniel Mwakyusa', 'Sara Mrisho',
  'Hamisi Ramadhani', 'Joyce Mbeo', 'Gerald Kambona', 'Fatuma Hassan', 'Deo Charles',
  'Esther Mwangi', 'John Mkwawa', 'Lilian Mbaga', 'Said Ally', 'Upendo Mfaume',
  'Kelvin Mwakasege', 'Asha Ngowi', 'Brian Lyatu', 'Zawadi Mgeni', 'Isaac Mwenda',
  'Sophia Kondo', 'Emmanuel Kileo', 'Mariam Bakari', 'Deogratius Nyoni', 'Tumaini Joseph',
  'Happy Sanga', 'Omary Salum', 'Beatrice Mushi', 'Yusuph Mwakalinga', 'Delia Kessy',
];

const PREFIXES = ['712', '713', '714', '715', '754', '755', '756', '762', '765', '784', '785', '678'];
const DEVICES = [
  'Android · Tecno Spark', 'Android · Samsung A14', 'iPhone · iPhone 11',
  'Android · Redmi Note 12', 'Android · Infinix Hot 30', 'iPhone · iPhone SE',
  'Android · Oppo A78', 'Windows · Laptop', 'Android · Vivo Y21', 'iPad · iPad 9',
];

interface MockToken {
  token: string;
  subscriptionId: number;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  issuedAt: string;
  expiresAt: string;
  deviceHint: string | null;
  deviceLabel: string | null;
}

interface MockSession {
  grantRef: string;
  subscriptionId: number;
  ipAddress: string;
  deviceIdentifier: string;
  connectedAt: string;
  bytesIn: number;
  bytesOut: number;
  endedAt: string | null;
  endReason: string | null;
}

interface MockPurchase {
  purchaseId: string;
  phone: string;
  packageId: number;
  createdAt: number;
  status: 'PENDING' | 'RESOLVED';
  failed: boolean;
  resolvedSubscriptionId: number | null;
}

export interface MockSms {
  id: number;
  phone: string;
  type: 'TOKEN' | 'CONFIRMATION';
  body: string;
  status: 'DELIVERED';
  createdAt: string;
}

export interface MockDb {
  packages: Package[];
  customers: Customer[];
  payments: Payment[];
  subscriptions: SubscriptionAdmin[];
  tokens: MockToken[];
  sessions: MockSession[];
  replacements: Replacement[];
  audits: AuditLog[];
  purchases: MockPurchase[];
  smsLog: MockSms[];
  loginAttempts: Map<string, { count: number; resetAt: number }>;
  nextId: number;
}

function makeDb(): MockDb {
  const db: MockDb = {
    packages: SEED_PACKAGES.map((p) => ({ ...p })),
    customers: [],
    payments: [],
    subscriptions: [],
    tokens: [],
    sessions: [],
    replacements: [],
    audits: [],
    purchases: [],
    smsLog: [],
    loginAttempts: new Map(),
    nextId: 1000,
  };

  const now = Date.now();

  // Customers
  for (let i = 0; i < NAMES.length; i++) {
    const phone = `+255${pick(PREFIXES)}${String(100000 + int(0, 899999)).slice(0, 6)}`;
    db.customers.push({
      id: i + 1,
      phoneE164: phone,
      displayName: NAMES[i],
      status: rand() < 0.05 ? 'SUSPENDED' : 'ACTIVE',
      firstSeenAt: new Date(now - int(1, 90) * 86400_000).toISOString(),
      lastSeenAt: new Date(now - int(0, 30) * 3600_000).toISOString(),
      activeSubscription: null,
      totalPurchases: 0,
      totalSpentTzs: 0,
      deviceLabel: null,
    });
  }

  // Payments over the last 90 days (weighted toward recent), incl. today
  const paymentCount = 560;
  for (let i = 0; i < paymentCount; i++) {
    const customer = db.customers[int(0, db.customers.length - 1)];
    // i === 0 seeds the demo token on a long package so it stays active
    const pkg = i === 0 ? db.packages[3] : db.packages[int(0, db.packages.length - 1)];
    const ageDays = Math.pow(rand(), 1.6) * 89; // skew recent
    const isToday = i < 23; // guarantee "today" revenue
    const paidAt = new Date(
      isToday ? now - int(1, 10) * 3600_000 : now - ageDays * 86400_000,
    ).toISOString();
    const roll = rand();
    const status: Payment['status'] =
      roll < 0.86 ? 'SUCCESS' : roll < 0.94 ? 'FAILED' : roll < 0.98 ? 'PENDING' : 'REFUNDED';
    const failed = status === 'FAILED';
    db.payments.push({
      id: i + 1,
      purchaseId: `pur_seed_${i + 1}`,
      customerId: customer.id,
      phoneE164: customer.phoneE164,
      packageId: pkg.id,
      packageName: pkg.name,
      amountTzs: pkg.priceTzs,
      provider: 'MPESA_DARAJA',
      providerReference: status === 'PENDING' ? null : `MP${String(260000000 + i)}`,
      status,
      failureReason: failed ? pick(['Customer cancelled the prompt', 'Insufficient balance', 'Timeout waiting for PIN entry']) : null,
      paidAt: status === 'PENDING' ? null : paidAt,
      createdAt: paidAt,
      activatedSubscriptionId: null,
    });
    customer.totalPurchases += 1;
    customer.totalSpentTzs += status === 'SUCCESS' ? pkg.priceTzs : 0;
    if (status === 'SUCCESS') {
      // Subscription derived from successful payment
      const startsAt = paidAt;
      const endsAt = new Date(new Date(paidAt).getTime() + pkg.durationSeconds * 1000).toISOString();
      const subStatus: SubscriptionStatus =
        new Date(endsAt).getTime() < now ? 'EXPIRED' : rand() < 0.97 ? 'ACTIVE' : 'SUSPENDED';
      const subId = db.subscriptions.length + 1;
      db.payments[db.payments.length - 1].activatedSubscriptionId = subId;
      db.subscriptions.push({
        id: subId,
        customerId: customer.id,
        phoneE164: customer.phoneE164,
        packageId: pkg.id,
        packageName: pkg.name,
        paymentId: db.payments[db.payments.length - 1].id,
        status: subStatus,
        startsAt,
        endsAt,
        activatedAt: startsAt,
        extensionCount: 0,
        deviceLabel: null,
        tokenHint: null,
      });
      if (subStatus === 'ACTIVE') {
        const tokenStr = i === 0 ? DEMO_TOKEN : randomToken();
        const label = pick(DEVICES);
        db.tokens.push({
          token: tokenStr,
          subscriptionId: subId,
          status: 'ACTIVE',
          issuedAt: startsAt,
          expiresAt: endsAt,
          deviceHint: i % 3 === 0 ? null : `dev_${subId}`,
          deviceLabel: i % 3 === 0 ? null : label,
        });
        db.subscriptions[db.subscriptions.length - 1].deviceLabel = i % 3 === 0 ? null : label;
        db.subscriptions[db.subscriptions.length - 1].tokenHint = tokenStr.slice(-4);
        customer.activeSubscription = summarize(db.subscriptions[db.subscriptions.length - 1]);
        customer.deviceLabel = i % 3 === 0 ? null : label;
        // Some of them online right now
        if (rand() < 0.45) {
          db.sessions.push({
            grantRef: `grant_${subId}`,
            subscriptionId: subId,
            ipAddress: `10.10.0.${int(2, 250)}`,
            deviceIdentifier: `mac_${subId}_${int(10, 99)}`,
            connectedAt: new Date(now - int(5, 900) * 60_000).toISOString(),
            bytesIn: int(1_000_000, 900_000_000),
            bytesOut: int(500_000, 300_000_000),
            endedAt: null,
            endReason: null,
          });
        }
      }
    }
  }

  // A few pending device-replacement requests
  const replStatuses: Replacement['status'][] = ['PENDING', 'PENDING', 'APPROVED', 'REJECTED'];
  replStatuses.forEach((st, idx) => {
    const customer = db.customers[idx * 3 + 1];
    const sub = db.subscriptions.find((s) => s.customerId === customer.id);
    if (!sub) return;
    db.replacements.push({
      id: idx + 1,
      customerId: customer.id,
      phoneE164: customer.phoneE164,
      subscriptionId: sub.id,
      reason: pick([
        'I broke my phone screen and got a new one',
        'Upgraded to a new phone',
        'My old phone was stolen',
        'Changed from phone to laptop',
      ]),
      oldDeviceLabel: customer.deviceLabel,
      newDeviceLabel: pick(DEVICES),
      status: st,
      reviewedBy: st === 'PENDING' ? null : MOCK_ADMIN.fullName,
      reviewedAt: st === 'PENDING' ? null : new Date(now - 3600_000).toISOString(),
      rejectionReason: st === 'REJECTED' ? 'Could not verify ownership — please visit the desk' : null,
      createdAt: new Date(now - int(1, 48) * 3600_000).toISOString(),
    });
  });

  // Audit trail seed
  const actions = [
    ['PACKAGE_UPDATE', 'package', 'Updated price of "24 Hours"'],
    ['SUBSCRIPTION_SUSPEND', 'subscription', 'Suspended subscription #'],
    ['CUSTOMER_SUSPEND', 'customer', 'Suspended customer for abuse'],
    ['DEVICE_REPLACEMENT_APPROVE', 'replacement', 'Approved device replacement'],
    ['PAYMENT_RESEND_TOKEN', 'payment', 'Resent access token via SMS'],
    ['SUBSCRIPTION_REVOKE', 'subscription', 'Revoked token after non-payment'],
  ] as const;
  for (let i = 0; i < 24; i++) {
    const [action, entityType, summary] = actions[int(0, actions.length - 1)];
    db.audits.push({
      id: i + 1,
      actorType: rand() < 0.25 ? 'SYSTEM' : 'ADMIN',
      actorName: rand() < 0.25 ? 'Scheduler' : MOCK_ADMIN.fullName,
      action,
      entityType,
      entityId: int(1, 400),
      ip: rand() < 0.25 ? null : `41.86.${int(0, 255)}.${int(1, 254)}`,
      createdAt: new Date(now - int(1, 720) * 3600_000).toISOString(),
      summary: `${summary}${entityType === 'subscription' ? ` ${int(1, 400)}` : ''}`,
    });
  }
  db.audits.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return db;
}

function randomToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `TKT-${seg(4)}-${seg(4)}-${seg(4)}`;
}

function summarize(sub: SubscriptionAdmin): import('@/types').SubscriptionSummary {
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

export const db: MockDb = makeDb();

/* ---------------- shared mock helpers ---------------- */

export function page<T>(all: T[], p: PageLike): Paged<T> {
  const pageNum = Math.max(1, p.page ?? 1);
  const size = Math.min(100, Math.max(1, p.size ?? 25));
  const start = (pageNum - 1) * size;
  return { items: all.slice(start, start + size), page: pageNum, size, total: all.length };
}
interface PageLike {
  page?: number;
  size?: number;
}

export function getPackage(id: number): Package | undefined {
  return db.packages.find((p) => p.id === id);
}

export function audit(
  action: string,
  entityType: string,
  entityId: number,
  summary: string,
  actor: 'ADMIN' | 'SYSTEM' = 'ADMIN',
): void {
  db.audits.unshift({
    id: db.nextId++,
    actorType: actor,
    actorName: actor === 'SYSTEM' ? 'Scheduler' : MOCK_ADMIN.fullName,
    action,
    entityType,
    entityId,
    ip: actor === 'SYSTEM' ? null : '127.0.0.1',
    createdAt: nowIso(),
    summary,
  });
}

export function pushSms(phone: string, type: MockSms['type'], body: string): void {
  db.smsLog.unshift({
    id: db.nextId++,
    phone,
    type,
    body,
    status: 'DELIVERED',
    createdAt: nowIso(),
  });
  if (db.smsLog.length > 50) db.smsLog.pop();
}

/** Revokes every other ACTIVE token for the subscription (FR-A03 rotation). */
export function rotateToken(subscriptionId: number, expiresAt: string): string {
  db.tokens.forEach((t) => {
    if (t.subscriptionId === subscriptionId && t.status === 'ACTIVE') t.status = 'REVOKED';
  });
  const token = randomToken();
  db.tokens.push({
    token,
    subscriptionId,
    status: 'ACTIVE',
    issuedAt: nowIso(),
    expiresAt,
    deviceHint: null,
    deviceLabel: null,
  });
  const sub = db.subscriptions.find((s) => s.id === subscriptionId);
  if (sub) sub.tokenHint = token.slice(-4);
  return token;
}

/** D-007 extension: remaining time preserved + new duration appended. */
export function extendSubscription(subId: number, extraSeconds: number): string {
  const sub = db.subscriptions.find((s) => s.id === subId);
  if (!sub) throw new Error('subscription missing');
  const currentEnd = new Date(sub.endsAt).getTime();
  const base = Math.max(currentEnd, Date.now());
  sub.endsAt = new Date(base + extraSeconds * 1000).toISOString();
  sub.extensionCount += 1;
  sub.status = 'ACTIVE';
  return sub.endsAt;
}

export function invalidateSessionsFor(subId: number, reason: string): void {
  db.sessions.forEach((s) => {
    if (s.subscriptionId === subId && !s.endedAt) {
      s.endedAt = nowIso();
      s.endReason = reason;
    }
  });
}

export { db as mockDb, getPackage as getMockPackage, summarize as summarizeSubscription };
export type { MockToken, MockSession, MockPurchase };
