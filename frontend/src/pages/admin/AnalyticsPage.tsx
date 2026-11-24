import { useEffect, useState } from 'react';
import type { Column } from '@/components';
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatCard,
  StatusBadge,
} from '@/components';
import {
  exportPaymentsCsv,
  getCustomerAnalytics,
  getPackageAnalytics,
  getRevenueAnalytics,
  listAdminPackages,
  listPayments,
} from '@/services/api';
import type {
  CustomerAnalytics,
  Package,
  PackageAnalyticsRow,
  Paged,
  Payment,
  PaymentStatus,
  RevenueAnalytics,
} from '@/types';
import { ApiError } from '@/types';
import { downloadCsv } from '@/utils/csv';
import { dateOffsetInTz, formatDateTime, formatPhone, formatTzsFull, todayInTz } from '@/utils/format';
import { PackagePieChart, RevenueBarChart } from './components/charts';
import { Download } from 'lucide-react';

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

const PAGE_SIZE = 10;

/**
 * Revenue analytics (§12): TZ-day buckets in Africa/Dar_es_Salaam, verified
 * SUCCESS payments only, gross vs profit distinguished (profit null until v1.1).
 */
export function AnalyticsPage() {
  const [from, setFrom] = useState(dateOffsetInTz(-30));
  const [to, setTo] = useState(todayInTz());
  const [packageId, setPackageId] = useState<number | ''>('');
  const [status, setStatus] = useState<PaymentStatus | ''>('');

  const [revenue, setRevenue] = useState<RevenueAnalytics | null>(null);
  const [pkgRows, setPkgRows] = useState<PackageAnalyticsRow[]>([]);
  const [customers, setCustomers] = useState<CustomerAnalytics | null>(null);
  const [payments, setPayments] = useState<Paged<Payment> | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listAdminPackages()
      .then((items) => {
        if (!cancelled) setPackages(items);
      })
      .catch(() => {
        /* filter metadata only */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = { from, to, packageId: packageId || undefined };
    Promise.all([
      getRevenueAnalytics(query),
      getPackageAnalytics({ from, to }),
      getCustomerAnalytics({ from, to }),
      listPayments({ from, to, packageId: packageId || undefined, status: status || undefined, size: PAGE_SIZE }),
    ])
      .then(([rev, pkgs, custs, pays]) => {
        if (cancelled) return;
        setRevenue(rev);
        setPkgRows(pkgs);
        setCustomers(custs);
        setPayments(pays);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(apiDetail(e, 'Could not load analytics.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, packageId, status, tick]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await exportPaymentsCsv({ from, to, packageId: packageId || undefined });
      downloadCsv(`payments_${from}_${to}.csv`, csv);
    } catch (e) {
      // toast-free fallback: alert-free inline handling via console is forbidden —
      // reuse page error banner
      setError(apiDetail(e, 'CSV export failed.'));
    } finally {
      setExporting(false);
    }
  };

  const paymentColumns: Column<Payment>[] = [
    { key: 'purchaseId', header: 'Reference', render: (r) => <span className="font-mono text-xs">{r.purchaseId}</span> },
    { key: 'phoneE164', header: 'Phone', render: (r) => formatPhone(r.phoneE164) },
    { key: 'packageName', header: 'Package' },
    { key: 'amountTzs', header: 'Amount', align: 'right', render: (r) => formatTzsFull(r.amountTzs) },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'paidAt', header: 'Paid at', render: (r) => formatDateTime(r.paidAt) },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Revenue and sales performance — Africa/Dar_es_Salaam"
        actions={
          <Button
            variant="outline"
            loading={exporting}
            icon={<Download size={16} />}
            onClick={handleExport}
          >
            Export CSV
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From" htmlFor="an-from" className="w-[150px]">
            <Input id="an-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To" htmlFor="an-to" className="w-[150px]">
            <Input id="an-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Package" htmlFor="an-pkg" className="w-[170px]">
            <Select id="an-pkg" value={packageId} onChange={(e) => setPackageId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">All packages</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment status" htmlFor="an-status" className="w-[160px]">
            <Select id="an-status" value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus | '')}>
              <option value="">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </Select>
          </Field>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState
          title="Could not load analytics"
          description={error}
          action={
            <Button variant="outline" onClick={() => setTick((t) => t + 1)}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            <StatCard label="Revenue" value={formatTzsFull(revenue?.totals.revenueTzs ?? 0)} tone="success" />
            <StatCard label="Successful payments" value={String(revenue?.totals.payments ?? 0)} />
            <StatCard label="Gross" value={formatTzsFull(revenue?.totals.grossTzs ?? 0)} />
            <StatCard
              label="Refunded"
              value={formatTzsFull(revenue?.totals.refundedTzs ?? 0)}
              tone={(revenue?.totals.refundedTzs ?? 0) > 0 ? 'warning' : 'default'}
            />
            <StatCard label="Profit" value="—" sub="expenses not tracked yet" tone="warning" />
          </div>

          {/* Charts */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card title="Revenue by day (TZS)">
              {revenue && revenue.buckets.length > 0 ? (
                <RevenueBarChart data={revenue.buckets} />
              ) : (
                <EmptyState title="No revenue in this range" description="Adjust the date filters to see data." />
              )}
            </Card>
            <Card title="Revenue share by package">
              {pkgRows.length > 0 ? (
                <PackagePieChart data={pkgRows} />
              ) : (
                <EmptyState title="No package sales" description="No successful payments in this range." />
              )}
            </Card>
          </div>

          {/* Customer analytics */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="New customers" value={String(customers?.newCustomers ?? 0)} icon={undefined} />
            <StatCard label="Returning customers" value={String(customers?.returningCustomers ?? 0)} />
            <StatCard label="Returning share" value={`${customers?.returningPercent ?? 0}%`} tone="success" />
            <StatCard label="Expired subscriptions" value={String(customers?.expiredSubscriptions ?? 0)} tone="warning" />
          </div>

          {/* Package performance list */}
          {pkgRows.length > 0 && (
            <Card title="Package performance" className="mt-4">
              <ul className="divide-y divide-slate-100">
                {pkgRows.map((r) => (
                  <li key={r.packageId} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{r.packageName}</p>
                      <p className="text-xs text-slate-500">{r.purchases} purchases</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-slate-800">{formatTzsFull(r.revenueTzs)}</p>
                      <p className="text-xs text-slate-500">{r.sharePercent}% of revenue</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Transactions */}
          <Card title="Transactions in range" className="mt-4" flush>
            <div className="p-4 sm:p-5">
              <DataTable
                columns={paymentColumns}
                rows={payments?.items ?? []}
                getRowKey={(r) => r.id}
                emptyTitle="No transactions"
                emptyDescription="No payments match the current filters."
              />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
