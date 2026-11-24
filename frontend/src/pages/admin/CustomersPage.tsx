import { useEffect, useState, type ReactNode } from 'react';
import type { Column } from '@/components';
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Input,
  Pagination,
  Select,
  Spinner,
  StatusBadge,
  useToast,
} from '@/components';
import {
  disconnectCustomer,
  getCustomer,
  listCustomers,
  reviewReplacement,
  setCustomerStatus,
} from '@/services/api';
import type {
  Customer,
  CustomerDetail,
  CustomerStatus,
  Paged,
  Payment,
  Replacement,
  SubscriptionAdmin,
} from '@/types';
import { ApiError } from '@/types';
import { formatDateTime, formatPhone, formatTzs } from '@/utils/format';

const PAGE_SIZE = 10;

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

type CustomerAction = 'suspend' | 'reactivate' | 'disconnect';

const ACTION_COPY: Record<CustomerAction, { title: string; message: string; confirm: string }> = {
  suspend: {
    title: 'Suspend customer',
    message:
      'Suspend this customer? Their access token will be revoked and any live session terminated. They cannot connect again until reactivated.',
    confirm: 'Suspend',
  },
  reactivate: {
    title: 'Reactivate customer',
    message:
      'Reactivate this customer? Their current subscription becomes usable again for the remainder of its paid duration.',
    confirm: 'Reactivate',
  },
  disconnect: {
    title: 'Disconnect customer',
    message:
      "Disconnect this customer's live session now? They will be cut off immediately and can only reconnect while their subscription is still valid.",
    confirm: 'Disconnect',
  },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function InfoPair({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="truncate text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

const PAYMENT_COLUMNS: Column<Payment>[] = [
  { key: 'createdAt', header: 'Date', render: (p) => formatDateTime(p.createdAt) },
  { key: 'packageName', header: 'Package' },
  { key: 'amountTzs', header: 'Amount', align: 'right', render: (p) => formatTzs(p.amountTzs) },
  { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
];

const SUBSCRIPTION_COLUMNS: Column<SubscriptionAdmin>[] = [
  { key: 'packageName', header: 'Package' },
  { key: 'startsAt', header: 'Started', render: (s) => formatDateTime(s.startsAt) },
  { key: 'endsAt', header: 'Expires', render: (s) => formatDateTime(s.endsAt) },
  { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
];

export function CustomersPage() {
  const toast = useToast();

  /* ---------------- list ---------------- */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerStatus | ''>('');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<Paged<Customer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* debounced search (300ms) */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listCustomers({
      search: search || undefined,
      status: status || undefined,
      page,
      size: PAGE_SIZE,
    })
      .then((res) => {
        if (!cancelled) {
          setRows(res);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRows(null);
          setError(apiDetail(e, 'Could not load customers.'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [search, status, page, tick]);

  /* ---------------- detail drawer ---------------- */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailTick, setDetailTick] = useState(0);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    getCustomer(selectedId)
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setDetailLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDetailError(apiDetail(e, 'Could not load customer details.'));
          setDetailLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, detailTick]);

  /* ---------------- mutations ---------------- */
  const [pendingAction, setPendingAction] = useState<CustomerAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function confirmAction() {
    if (!pendingAction || !detail) return;
    setActionLoading(true);
    try {
      if (pendingAction === 'suspend') {
        await setCustomerStatus(detail.id, 'SUSPENDED');
        toast.success('Customer suspended');
      } else if (pendingAction === 'reactivate') {
        await setCustomerStatus(detail.id, 'ACTIVE');
        toast.success('Customer reactivated');
      } else {
        await disconnectCustomer(detail.id);
        toast.success('Customer disconnected');
      }
      setPendingAction(null);
      setDetailTick((t) => t + 1);
      setTick((t) => t + 1);
    } catch (e: unknown) {
      toast.error(apiDetail(e, 'Action failed. Please try again.'));
    } finally {
      setActionLoading(false);
    }
  }

  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [pendingReject, setPendingReject] = useState<Replacement | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  async function approveReplacement(r: Replacement) {
    setReviewingId(r.id);
    try {
      await reviewReplacement(r.id, 'APPROVED');
      toast.success('Device replacement approved');
      setDetailTick((t) => t + 1);
    } catch (e: unknown) {
      toast.error(apiDetail(e, 'Could not approve the replacement.'));
    } finally {
      setReviewingId(null);
    }
  }

  async function confirmReject() {
    if (!pendingReject) return;
    setRejectLoading(true);
    try {
      await reviewReplacement(pendingReject.id, 'REJECTED');
      toast.success('Device replacement rejected');
      setPendingReject(null);
      setDetailTick((t) => t + 1);
    } catch (e: unknown) {
      toast.error(apiDetail(e, 'Could not reject the replacement.'));
    } finally {
      setRejectLoading(false);
    }
  }

  /* ---------------- table ---------------- */
  const columns: Column<Customer>[] = [
    {
      key: 'phone',
      header: 'Phone',
      render: (c) => <span className="font-medium text-slate-900">{formatPhone(c.phoneE164)}</span>,
    },
    {
      key: 'package',
      header: 'Current package',
      render: (c) => c.activeSubscription?.packageName ?? '—',
    },
    { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
    {
      key: 'expires',
      header: 'Expires',
      render: (c) => (c.activeSubscription ? formatDateTime(c.activeSubscription.endsAt) : '—'),
    },
    { key: 'device', header: 'Device', render: (c) => c.deviceLabel ?? '—' },
    {
      key: 'purchases',
      header: 'Purchases',
      align: 'right',
      render: (c) => c.totalPurchases.toLocaleString(),
    },
  ];

  const totalPages = Math.max(1, Math.ceil((rows?.total ?? 0) / PAGE_SIZE));
  const copy = pendingAction ? ACTION_COPY[pendingAction] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Customers</h1>
          <p className="mt-1 text-sm text-slate-500">Search, inspect and manage registered buyers.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          type="search"
          aria-label="Search customers"
          placeholder="Search phone or name"
          className="w-full sm:w-72"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          aria-label="Filter by status"
          className="w-full sm:w-44"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as CustomerStatus | '');
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            title="Could not load customers"
            description={error}
            action={
              <Button variant="outline" size="sm" onClick={() => setTick((t) => t + 1)}>
                Retry
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={rows?.items ?? []}
            getRowKey={(c) => c.id}
            onRowClick={(c) => setSelectedId(c.id)}
            emptyTitle="No customers found"
            emptyDescription={
              search || status
                ? 'Try adjusting your search or filters.'
                : 'Customers appear here after their first purchase.'
            }
          />
        )}
        {rows && !loading && !error && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={rows.total}
            onChange={setPage}
          />
        )}
      </Card>

      {/* Detail drawer */}
      <Drawer
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail ? formatPhone(detail.phoneE164) : 'Customer detail'}
        width="lg"
        footer={
          detail && !detailLoading && !detailError ? (
            <>
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Close
              </Button>
              <Button variant="danger" onClick={() => setPendingAction('disconnect')}>
                Disconnect
              </Button>
              {detail.status === 'ACTIVE' ? (
                <Button variant="secondary" onClick={() => setPendingAction('suspend')}>
                  Suspend
                </Button>
              ) : (
                <Button variant="success" onClick={() => setPendingAction('reactivate')}>
                  Reactivate
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {detailLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : detailError ? (
          <EmptyState
            title="Could not load customer"
            description={detailError}
            action={
              <Button variant="outline" size="sm" onClick={() => setDetailTick((t) => t + 1)}>
                Retry
              </Button>
            }
          />
        ) : detail ? (
          <div className="space-y-5">
            <Section title="Profile">
              <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
                <InfoPair label="Phone" value={formatPhone(detail.phoneE164)} />
                <InfoPair label="Name" value={detail.displayName ?? '—'} />
                <InfoPair label="Status" value={<StatusBadge status={detail.status} />} />
                <InfoPair
                  label="Total spent"
                  value={`${formatTzs(detail.totalSpentTzs)} TZS`}
                />
                <InfoPair label="First seen" value={formatDateTime(detail.firstSeenAt)} />
                <InfoPair label="Last seen" value={formatDateTime(detail.lastSeenAt)} />
              </dl>
            </Section>

            <Section title="Current subscription">
              {detail.activeSubscription ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {detail.activeSubscription.packageName}
                    </p>
                    <StatusBadge status={detail.activeSubscription.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDateTime(detail.activeSubscription.startsAt)} →{' '}
                    {formatDateTime(detail.activeSubscription.endsAt)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No active subscription.</p>
              )}
            </Section>

            <Section title="Device">
              {detail.device ? (
                <div className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-medium text-slate-800">{detail.device.deviceLabel}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Status: {detail.device.status} · Bound {formatDateTime(detail.device.boundAt)}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No registered device.</p>
              )}
            </Section>

            <Section title="Purchases">
              <DataTable
                columns={PAYMENT_COLUMNS}
                rows={detail.payments}
                getRowKey={(p) => p.id}
                emptyTitle="No purchases"
                emptyDescription="This customer has not purchased a package yet."
              />
            </Section>

            <Section title="Subscription history">
              <DataTable
                columns={SUBSCRIPTION_COLUMNS}
                rows={detail.subscriptions}
                getRowKey={(s) => s.id}
                emptyTitle="No subscriptions"
                emptyDescription="No subscription records for this customer."
              />
            </Section>

            <Section title="Device replacement requests">
              {detail.replacements.length === 0 ? (
                <p className="text-sm text-slate-500">No replacement requests.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.replacements.map((r) => (
                    <li key={r.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm text-slate-700">{r.reason}</p>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {r.oldDeviceLabel ?? '—'} → {r.newDeviceLabel ?? 'new device'} ·{' '}
                        {formatDateTime(r.createdAt)}
                      </p>
                      {r.status === 'REJECTED' && r.rejectionReason && (
                        <p className="mt-1 text-xs text-red-600">Reason: {r.rejectionReason}</p>
                      )}
                      {r.status === 'PENDING' && (
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="success"
                            loading={reviewingId === r.id}
                            onClick={() => approveReplacement(r)}
                          >
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setPendingReject(r)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        ) : null}
      </Drawer>

      {/* Destructive confirmations */}
      <ConfirmDialog
        open={pendingAction !== null}
        title={copy?.title ?? 'Confirm'}
        message={copy?.message ?? ''}
        confirmLabel={copy?.confirm}
        danger={pendingAction === 'disconnect'}
        loading={actionLoading}
        onConfirm={confirmAction}
        onCancel={() => setPendingAction(null)}
      />

      <ConfirmDialog
        open={pendingReject !== null}
        title="Reject device replacement"
        message="Reject this device-replacement request? The customer keeps their current device binding and must contact support again."
        confirmLabel="Reject"
        danger
        loading={rejectLoading}
        onConfirm={confirmReject}
        onCancel={() => setPendingReject(null)}
      />
    </div>
  );
}
