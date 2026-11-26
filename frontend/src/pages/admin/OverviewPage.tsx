import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock,
  CalendarDays,
  Clock,
  Coins,
  Hourglass,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  Wifi,
  XCircle,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
} from '@/components';
import { getOverview, getRevenueAnalytics, listPayments } from '@/services/api';
import type { Paged, Payment, RevenueAnalytics, StatsOverview } from '@/types';
import { ApiError } from '@/types';
import {
  dateOffsetInTz,
  formatDateTime,
  formatTzs,
  formatTzsFull,
  maskPhone,
  todayInTz,
} from '@/utils/format';
import { RevenueAreaChart } from './components/charts';

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

function SectionSpinner() {
  return (
    <div className="flex justify-center py-10">
      <Spinner />
    </div>
  );
}

export function OverviewPage() {
  const [tick, setTick] = useState(0);

  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  const [recent, setRecent] = useState<Paged<Payment> | null>(null);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setStatsLoading(true);
    setStatsError(null);
    getOverview()
      .then((d) => {
        if (!cancelled) setStats(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setStatsError(apiDetail(e, 'Could not load overview statistics.'));
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    setRevenueLoading(true);
    setRevenueError(null);
    getRevenueAnalytics({ from: dateOffsetInTz(-30), to: todayInTz() })
      .then((d) => {
        if (!cancelled) setRevenue(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setRevenueError(apiDetail(e, 'Could not load revenue history.'));
      })
      .finally(() => {
        if (!cancelled) setRevenueLoading(false);
      });

    setRecentLoading(true);
    setRecentError(null);
    listPayments({ size: 6 })
      .then((d) => {
        if (!cancelled) setRecent(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setRecentError(apiDetail(e, 'Could not load recent payments.'));
      })
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tick]);

  const retry = () => setTick((t) => t + 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle={`Revenue in Africa/Dar_es_Salaam · today ${todayInTz()}`}
        actions={
          stats ? (
            <Badge tone={stats.enforcementActive ? 'success' : 'warning'} dot>
              {stats.enforcementActive ? 'Enforcement ON' : 'Soft gate (enforcement OFF)'}
            </Badge>
          ) : null
        }
      />

      {/* KPI row 1 — revenue */}
      {statsLoading ? (
        <SectionSpinner />
      ) : statsError ? (
        <EmptyState
          title="Could not load overview"
          description={statsError}
          action={
            <Button variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          }
        />
      ) : stats ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Revenue today" value={formatTzsFull(stats.revenueToday)} icon={Wallet} />
            <StatCard label="This week" value={formatTzsFull(stats.revenueWeek)} icon={CalendarDays} />
            <StatCard label="This month" value={formatTzsFull(stats.revenueMonth)} icon={CalendarClock} />
            <StatCard label="This year" value={formatTzsFull(stats.revenueYear)} icon={TrendingUp} />
            <StatCard label="Total revenue" value={formatTzsFull(stats.revenueTotal)} icon={Coins} />
          </div>

          {/* KPI row 2 — activity */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard
              label="Active subs"
              value={stats.activeSubscriptions.toLocaleString()}
              icon={Users}
            />
            <StatCard
              label="Connected"
              value={stats.connectedCustomers.toLocaleString()}
              icon={Wifi}
            />
            <StatCard
              label="Purchases"
              value={stats.totalPurchases.toLocaleString()}
              icon={ShoppingCart}
            />
            <StatCard
              label="Expired"
              value={stats.expiredSubscriptions.toLocaleString()}
              icon={Hourglass}
            />
            <StatCard
              label="Failed payments"
              value={stats.failedPayments.toLocaleString()}
              icon={XCircle}
              tone={stats.failedPayments > 0 ? 'danger' : 'default'}
            />
            <StatCard
              label="Pending payments"
              value={stats.pendingPayments.toLocaleString()}
              icon={Clock}
              tone={stats.pendingPayments > 0 ? 'warning' : 'default'}
            />
          </div>
        </div>
      ) : null}

      {/* Revenue — last 30 days */}
      <Card title="Revenue — last 30 days (TZS)">
        {revenueLoading ? (
          <SectionSpinner />
        ) : revenueError ? (
          <EmptyState
            title="Could not load revenue"
            description={revenueError}
            action={
              <Button variant="outline" size="sm" onClick={retry}>
                Retry
              </Button>
            }
          />
        ) : revenue && revenue.buckets.length > 0 ? (
          <RevenueAreaChart data={revenue.buckets} />
        ) : (
          <EmptyState
            title="No revenue in this range"
            description="Successful payments from the last 30 days will appear here."
          />
        )}
      </Card>

      {/* Recent payments */}
      <Card
        title="Recent payments"
        action={
          <Link
            to="/admin/payments"
            className="text-sm font-medium text-leaf-600 hover:text-leaf-700"
          >
            View all
          </Link>
        }
      >
        {recentLoading ? (
          <SectionSpinner />
        ) : recentError ? (
          <EmptyState
            title="Could not load payments"
            description={recentError}
            action={
              <Button variant="outline" size="sm" onClick={retry}>
                Retry
              </Button>
            }
          />
        ) : recent && recent.items.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {recent.items.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs tabular-nums text-slate-500">
                    {formatDateTime(p.createdAt)}
                  </span>
                  <span className="text-sm font-medium text-slate-800">{maskPhone(p.phoneE164)}</span>
                  <span className="truncate text-sm text-slate-500">{p.packageName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-slate-900">
                    {formatTzs(p.amountTzs)}
                  </span>
                  <StatusBadge status={p.status} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No payments yet"
            description="New purchases will appear here as they come in."
          />
        )}
      </Card>
    </div>
  );
}
