import { useEffect, useState } from 'react';
import type { Column } from '@/components';
import {
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  Pagination,
  Select,
  Spinner,
  StatusBadge,
  useToast,
} from '@/components';
import {
  exportPaymentsCsv,
  listAdminPackages,
  listPayments,
  resendToken,
} from '@/services/api';
import type { Package, Paged, Payment, PaymentQuery, PaymentStatus } from '@/types';
import { ApiError } from '@/types';
import { downloadCsv } from '@/utils/csv';
import {
  dateOffsetInTz,
  formatDateTime,
  formatPhone,
  formatTzsFull,
  todayInTz,
} from '@/utils/format';

const PAGE_SIZE = 25;

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

export function PaymentsPage() {
  const toast = useToast();

  /* ---------------- filters ---------------- */
  const [from, setFrom] = useState(dateOffsetInTz(-30));
  const [to, setTo] = useState(todayInTz());
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [packageId, setPackageId] = useState<number | ''>('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');

  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [rows, setRows] = useState<Paged<Payment> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* package options for the filter */
  const [packages, setPackages] = useState<Package[]>([]);

  useEffect(() => {
    let cancelled = false;
    listAdminPackages()
      .then((items) => {
        if (!cancelled) setPackages(items);
      })
      .catch(() => {
        /* filter metadata only — table keeps working with 'All packages' */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* debounced phone search (300ms) */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setPhone(phoneInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [phoneInput]);

  useEffect(() => {
    let cancelled = false;
    const query: PaymentQuery = {
      from: from || undefined,
      to: to || undefined,
      status: status || undefined,
      packageId: packageId || undefined,
      phone: phone || undefined,
      page,
      size: PAGE_SIZE,
    };
    setLoading(true);
    setError(null);
    listPayments(query)
      .then((res) => {
        if (!cancelled) {
          setRows(res);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setRows(null);
          setError(apiDetail(e, 'Could not load payments.'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [from, to, status, packageId, phone, page, tick]);

  /* ---------------- CSV export ---------------- */
  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const csv = await exportPaymentsCsv({
        from,
        to,
        packageId: packageId || undefined,
      });
      downloadCsv('payments.csv', csv);
      toast.success('Payments exported');
    } catch (e: unknown) {
      toast.error(apiDetail(e, 'Could not export payments.'));
    } finally {
      setExporting(false);
    }
  }

  /* ---------------- resend token ---------------- */
  const [resend, setResend] = useState<Payment | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  async function confirmResend() {
    if (!resend) return;
    setResendLoading(true);
    try {
      await resendToken(resend.id);
      toast.success('Token resent');
      setResend(null);
    } catch (e: unknown) {
      toast.error(apiDetail(e, 'Could not resend the token.'));
    } finally {
      setResendLoading(false);
    }
  }

  /* ---------------- table ---------------- */
  const columns: Column<Payment>[] = [
    {
      key: 'purchaseId',
      header: 'Reference',
      render: (p) => (
        <span className="font-mono text-xs text-slate-600">{p.purchaseId}</span>
      ),
    },
    {
      key: 'phoneE164',
      header: 'Phone',
      render: (p) => <span className="font-medium text-slate-900">{formatPhone(p.phoneE164)}</span>,
    },
    { key: 'packageName', header: 'Package' },
    {
      key: 'amountTzs',
      header: 'Amount',
      align: 'right',
      render: (p) => <span className="tabular-nums">{formatTzsFull(p.amountTzs)}</span>,
    },
    { key: 'provider', header: 'Provider' },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'paidAt',
      header: 'Paid at',
      render: (p) => formatDateTime(p.paidAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) =>
        p.status === 'SUCCESS' ? (
          <Button size="sm" variant="outline" onClick={() => setResend(p)}>
            Resend token
          </Button>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil((rows?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Payments</h1>
          <p className="mt-1 text-sm text-slate-500">
            All transactions, newest first — dates in Africa/Dar_es_Salaam.
          </p>
        </div>
        <Button
          variant="outline"
          loading={exporting}
          onClick={() => void exportCsv()}
        >
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Field label="From" htmlFor="pay-from" className="w-[calc(50%-0.375rem)] sm:w-44">
          <Input
            id="pay-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="To" htmlFor="pay-to" className="w-[calc(50%-0.375rem)] sm:w-44">
          <Input
            id="pay-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Status" htmlFor="pay-status" className="w-[calc(50%-0.375rem)] sm:w-40">
          <Select
            id="pay-status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as PaymentStatus | '');
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="PENDING">Pending</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </Select>
        </Field>
        <Field label="Package" htmlFor="pay-package" className="w-[calc(50%-0.375rem)] sm:w-44">
          <Select
            id="pay-package"
            value={packageId === '' ? '' : String(packageId)}
            onChange={(e) => {
              setPackageId(e.target.value === '' ? '' : Number(e.target.value));
              setPage(1);
            }}
          >
            <option value="">All</option>
            {packages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Phone" htmlFor="pay-phone" className="w-full sm:w-48">
          <Input
            id="pay-phone"
            type="search"
            placeholder="Search phone"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
          />
        </Field>
      </div>

      <Card>
        {loading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : error ? (
          <EmptyState
            title="Could not load payments"
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
            getRowKey={(p) => p.id}
            emptyTitle="No payments found"
            emptyDescription="No transactions match the current filters and date range."
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
        open={resend !== null}
        title="Resend access token"
        message={`Send the access token for ${resend ? formatPhone(resend.phoneE164) : ''} again by SMS? The same token is re-sent — it is never shown in this console.`}
        confirmLabel="Resend token"
        loading={resendLoading}
        onConfirm={confirmResend}
        onCancel={() => setResend(null)}
      />
    </div>
  );
}
