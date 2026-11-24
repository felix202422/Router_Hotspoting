import { useEffect, useState, type ReactNode } from 'react';
import type { Column } from '@/components';
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Pagination,
  Spinner,
  StatusBadge,
  useToast,
} from '@/components';
import { listSubscriptions, subscriptionAction } from '@/services/api';
import type { Paged, SubscriptionAdmin, SubscriptionQuery } from '@/types';
import { ApiError } from '@/types';
import { cn } from '@/utils/cn';
import { formatDateTime, formatPhone, formatRemaining } from '@/utils/format';

const PAGE_SIZE = 10;

type Tab = 'all' | 'active' | 'expiring' | 'expired' | 'suspended';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'expiring', label: 'Expiring soon (24h)' },
  { key: 'expired', label: 'Expired' },
  { key: 'suspended', label: 'Suspended' },
];

const EMPTY_COPY: Record<Tab, { title: string; description: string }> = {
  all: { title: 'No subscriptions', description: 'Subscriptions appear here after a purchase.' },
  active: { title: 'No active subscriptions', description: 'Active subscriptions will show up here.' },
  expiring: {
    title: 'Nothing expiring soon',
    description: 'No active subscription expires within the next 24 hours.',
  },
  expired: { title: 'No expired subscriptions', description: 'Expired subscriptions will show up here.' },
  suspended: { title: 'No suspended subscriptions', description: 'Suspended subscriptions will show up here.' },
};

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

function isFuture(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

export function SubscriptionsPage() {
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<Paged<SubscriptionAdmin> | null>(null);
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
    const query: SubscriptionQuery = {
      page,
      size: PAGE_SIZE,
      search: search || undefined,
    };
    if (tab === 'active') query.status = 'ACTIVE';
    else if (tab === 'expired') query.status = 'EXPIRED';
    else if (tab === 'suspended') query.status = 'SUSPENDED';
    else if (tab === 'expiring') query.expiringWithinHours = 24;

    setLoading(true);
    setError(null);
    listSubscriptions(query)
      .then((res) => {
        if (!cancelled) {
          setRows(res);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRows(null);
          setError(apiDetail(e, 'Could not load subscriptions.'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, search, page, tick]);

  /* ---------------- actions ---------------- */
  const [confirmState, setConfirmState] = useState<{
    sub: SubscriptionAdmin;
    action: 'suspend' | 'revoke';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function confirmAction() {
    if (!confirmState) return;
    setActionLoading(true);
    try {
      await subscriptionAction(confirmState.sub.id, confirmState.action);
      toast.success(
        confirmState.action === 'suspend' ? 'Subscription suspended' : 'Subscription revoked',
      );
      setConfirmState(null);
      setTick((t) => t + 1);
    } catch (e: unknown) {
      toast.error(apiDetail(e, 'Action failed. Please try again.'));
    } finally {
      setActionLoading(false);
    }
  }

  async function resume(sub: SubscriptionAdmin) {
    setBusyId(sub.id);
    try {
      await subscriptionAction(sub.id, 'resume');
      toast.success('Subscription resumed');
      setTick((t) => t + 1);
    } catch (e: unknown) {
      toast.error(apiDetail(e, 'Could not resume the subscription.'));
    } finally {
      setBusyId(null);
    }
  }

  /* ---------------- table ---------------- */
  const columns: Column<SubscriptionAdmin>[] = [
    {
      key: 'phone',
      header: 'Phone',
      render: (s) => <span className="font-medium text-slate-900">{formatPhone(s.phoneE164)}</span>,
    },
    { key: 'packageName', header: 'Package' },
    { key: 'startsAt', header: 'Started', render: (s) => formatDateTime(s.startsAt) },
    { key: 'endsAt', header: 'Expires', render: (s) => formatDateTime(s.endsAt) },
    {
      key: 'remaining',
      header: 'Remaining',
      render: (s) => {
        const ms = new Date(s.endsAt).getTime() - Date.now();
        return ms <= 0 ? '—' : formatRemaining(Math.floor(ms / 1000));
      },
    },
    { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
    {
      key: 'extensionCount',
      header: 'Extensions',
      align: 'right',
      hideOnMobile: true,
      render: (s) => String(s.extensionCount),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => {
        const notPast = isFuture(s.endsAt);
        const actions: ReactNode[] = [];
        if (s.status === 'ACTIVE') {
          actions.push(
            <Button
              key="suspend"
              size="sm"
              variant="outline"
              onClick={() => setConfirmState({ sub: s, action: 'suspend' })}
            >
              Suspend
            </Button>,
          );
        }
        if (s.status === 'SUSPENDED' && notPast) {
          actions.push(
            <Button
              key="resume"
              size="sm"
              variant="outline"
              loading={busyId === s.id}
              onClick={() => void resume(s)}
            >
              Resume
            </Button>,
          );
        }
        if (notPast) {
          actions.push(
            <Button
              key="revoke"
              size="sm"
              variant="danger"
              onClick={() => setConfirmState({ sub: s, action: 'revoke' })}
            >
              Revoke
            </Button>,
          );
        }
        if (actions.length === 0) {
          return <span className="text-slate-400">—</span>;
        }
        return <div className="flex flex-wrap justify-end gap-1.5">{actions}</div>;
      },
    },
  ];

  const totalPages = Math.max(1, Math.ceil((rows?.total ?? 0) / PAGE_SIZE));
  const empty = EMPTY_COPY[tab];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Subscriptions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every purchased access period, with lifecycle controls.
        </p>
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Subscription filters">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.key
                  ? 'border-electric-600 bg-electric-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Input
          type="search"
          aria-label="Search subscriptions"
          placeholder="Search phone or package"
          className="w-full lg:w-72"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            title="Could not load subscriptions"
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
            getRowKey={(s) => s.id}
            emptyTitle={empty.title}
            emptyDescription={empty.description}
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

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.action === 'revoke' ? 'Revoke subscription' : 'Suspend subscription'}
        message={
          confirmState?.action === 'revoke'
            ? 'This revokes the token and terminates access. The customer can no longer connect and must purchase a new package. This cannot be undone.'
            : 'Suspend this subscription? The access token is revoked and any live session terminated. It can be resumed while the paid duration has not passed.'
        }
        confirmLabel={confirmState?.action === 'revoke' ? 'Revoke' : 'Suspend'}
        danger
        loading={actionLoading}
        onConfirm={confirmAction}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
