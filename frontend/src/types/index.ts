/**
 * Shared types — mirror of the API contract (docs/api/api-contract.md).
 * Phase 4 backend MUST conform to these shapes (contract tests).
 */

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
export type SubscriptionStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
export type TokenStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type CustomerStatus = 'ACTIVE' | 'SUSPENDED';
export type PackageStatus = 'ACTIVE' | 'INACTIVE';
export type ReplacementStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SmsStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
export type SubscriptionAction = 'suspend' | 'resume' | 'revoke';

/* ------------------------------------------------------------------ */
/* Packages                                                            */
/* ------------------------------------------------------------------ */

export interface Package {
  id: number;
  name: string;
  description: string;
  priceTzs: number;
  durationSeconds: number;
  dataAllowanceBytes: number | null;
  maxDownloadKbps: number | null;
  maxUploadKbps: number | null;
  deviceLimit: number;
  status: PackageStatus;
  sortOrder: number;
  /** Admin-only aggregate (mock computes it). */
  activeSubscriberCount?: number;
}

export interface PackageInput {
  name: string;
  description: string;
  priceTzs: number;
  durationSeconds: number;
  dataAllowanceBytes: number | null;
  maxDownloadKbps: number | null;
  maxUploadKbps: number | null;
  deviceLimit: number;
  status: PackageStatus;
  sortOrder: number;
}

/* ------------------------------------------------------------------ */
/* Customers / devices / replacements                                  */
/* ------------------------------------------------------------------ */

export interface RegisteredDevice {
  id: number;
  deviceLabel: string;
  macHint: string | null;
  status: 'ACTIVE' | 'REMOVED';
  boundAt: string | null;
}

export interface SubscriptionSummary {
  id: number;
  packageId: number;
  packageName: string;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string;
  /** Seconds left, computed server-side (mock) at response time. */
  remainingSeconds?: number;
}

export interface Customer {
  id: number;
  phoneE164: string;
  displayName: string | null;
  status: CustomerStatus;
  firstSeenAt: string;
  lastSeenAt: string | null;
  activeSubscription: SubscriptionSummary | null;
  totalPurchases: number;
  totalSpentTzs: number;
  deviceLabel: string | null;
}

export interface CustomerDetail extends Customer {
  payments: Payment[];
  subscriptions: SubscriptionAdmin[];
  device: RegisteredDevice | null;
  replacements: Replacement[];
}

export interface Replacement {
  id: number;
  customerId: number;
  phoneE164: string;
  subscriptionId: number;
  reason: string;
  oldDeviceLabel: string | null;
  newDeviceLabel: string | null;
  status: ReplacementStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

export interface SubscriptionAdmin {
  id: number;
  customerId: number;
  phoneE164: string;
  packageId: number;
  packageName: string;
  paymentId: number;
  status: SubscriptionStatus;
  startsAt: string;
  endsAt: string;
  activatedAt: string | null;
  extensionCount: number;
  deviceLabel: string | null;
  tokenHint: string | null;
}

/* ------------------------------------------------------------------ */
/* Payments / purchases                                                */
/* ------------------------------------------------------------------ */

export interface Payment {
  id: number;
  purchaseId: string;
  customerId: number;
  phoneE164: string;
  packageId: number;
  packageName: string;
  amountTzs: number;
  provider: string;
  providerReference: string | null;
  status: PaymentStatus;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  /** Set exactly once when the payment activates/extends a subscription (idempotency anchor). */
  activatedSubscriptionId: number | null;
}

export interface PurchaseInitResponse {
  purchaseId: string;
  status: 'PENDING';
  package: { name: string; priceTzs: number; durationSeconds: number };
  phone: string;
  paymentInstructions: string;
}

export interface PurchaseStatusResponse {
  purchaseId: string;
  status: PaymentStatus;
  failureReason: string | null;
  subscription: SubscriptionSummary | null;
}

/* ------------------------------------------------------------------ */
/* Token login / subscription view / device replacement                */
/* ------------------------------------------------------------------ */

export interface TokenLoginResponse {
  subscription: SubscriptionSummary;
  session: { state: 'CONNECTED'; boundAt: string };
}

export interface SubscriptionInfo {
  customer: { phoneE164: string };
  subscription: SubscriptionSummary;
  device: {
    registered: boolean;
    deviceLabel: string | null;
    boundAt: string | null;
  };
}

export interface DeviceReplacementRequest {
  requestId: number;
  status: ReplacementStatus;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Network (controller-backed — never fabricated, FR-D06)              */
/* ------------------------------------------------------------------ */

export interface NetworkHealth {
  enforcementActive: boolean;
  controller: 'MIKROTIK' | 'MOCK' | 'NONE';
  reachable: boolean;
  lastSyncAt: string | null;
  drift: number;
}

export interface NetworkSession {
  grantRef: string;
  ipAddress: string;
  deviceIdentifier: string;
  phoneE164: string;
  subscriptionId: number;
  packageName: string;
  connectedAt: string;
  durationSeconds: number;
  bytesIn: number;
  bytesOut: number;
  state: 'CONNECTED';
}

/* ------------------------------------------------------------------ */
/* Dashboard / analytics                                               */
/* ------------------------------------------------------------------ */

export interface StatsOverview {
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  revenueYear: number;
  revenueTotal: number;
  activeSubscriptions: number;
  connectedCustomers: number;
  totalPurchases: number;
  expiredSubscriptions: number;
  failedPayments: number;
  pendingPayments: number;
  enforcementActive: boolean;
}

export type AnalyticsRange = 'today' | 'week' | 'month' | 'year';

export interface RevenueBucket {
  period: string;
  revenueTzs: number;
  payments: number;
}

export interface RevenueAnalytics {
  currency: 'TZS';
  buckets: RevenueBucket[];
  totals: {
    revenueTzs: number;
    payments: number;
    grossTzs: number;
    refundedTzs: number;
    profitTzs: number | null;
  };
}

export interface PackageAnalyticsRow {
  packageId: number;
  packageName: string;
  purchases: number;
  revenueTzs: number;
  sharePercent: number;
}

export interface CustomerAnalytics {
  newCustomers: number;
  returningCustomers: number;
  returningPercent: number;
  expiredSubscriptions: number;
}

/* ------------------------------------------------------------------ */
/* Auth / audit / paging                                               */
/* ------------------------------------------------------------------ */

export interface AdminProfile {
  id: number;
  email: string;
  fullName: string;
  role: 'ADMIN';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  profile: AdminProfile;
}

export interface AuditLog {
  id: number;
  actorType: 'ADMIN' | 'SYSTEM';
  actorName: string;
  action: string;
  entityType: string;
  entityId: number;
  ip: string | null;
  createdAt: string;
  summary: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface PageParams {
  page?: number;
  size?: number;
}

export interface CustomerQuery extends PageParams {
  search?: string;
  status?: CustomerStatus | '';
}

export interface SubscriptionQuery extends PageParams {
  status?: SubscriptionStatus | '';
  search?: string;
  expiringWithinHours?: number;
}

export interface PaymentQuery extends PageParams {
  from?: string;
  to?: string;
  status?: PaymentStatus | '';
  packageId?: number | '';
  phone?: string;
}

export interface AnalyticsQuery {
  from: string;
  to: string;
  packageId?: number | '';
  status?: PaymentStatus | '';
}

/* ------------------------------------------------------------------ */
/* Problem+json error envelope (api-contract §1)                       */
/* ------------------------------------------------------------------ */

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  traceId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail;

  constructor(problem: ProblemDetail) {
    super(problem.detail || problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.problem = problem;
  }
}
