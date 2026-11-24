import { useEffect, useState } from 'react';
import type { Column } from '@/components';
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  Spinner,
} from '@/components';
import { listAuditLogs } from '@/services/api';
import type { AuditLog, Paged } from '@/types';
import { ApiError } from '@/types';
import { formatDateTime } from '@/utils/format';
import { RefreshCw } from 'lucide-react';

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

const PAGE_SIZE = 25;

/** Read-only admin audit trail (§15). */
export function AuditLogPage() {
  const [rows, setRows] = useState<Paged<AuditLog> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAuditLogs({ page, size: PAGE_SIZE })
      .then((data) => {
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(apiDetail(e, 'Could not load audit logs.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, tick]);

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      header: 'Time',
      render: (r) => <span className="whitespace-nowrap">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actorName',
      header: 'Actor',
      render: (r) => (
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{r.actorName}</span>
          <Badge tone={r.actorType === 'SYSTEM' ? 'info' : 'neutral'}>
            {r.actorType === 'SYSTEM' ? 'System' : 'Admin'}
          </Badge>
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (r) => <span className="font-mono text-xs text-slate-600">{r.action}</span>,
    },
    {
      key: 'entityType',
      header: 'Entity',
      render: (r) => (
        <span className="text-slate-600">
          {r.entityType} #{r.entityId}
        </span>
      ),
      hideOnMobile: true,
    },
    { key: 'summary', header: 'Summary', render: (r) => <span className="text-slate-700">{r.summary}</span> },
    {
      key: 'ip',
      header: 'IP',
      render: (r) => <span className="font-mono text-xs">{r.ip ?? 'system'}</span>,
      hideOnMobile: true,
    },
  ];

  const totalPages = rows ? Math.max(1, Math.ceil(rows.total / rows.size)) : 1;

  return (
    <div>
      <PageHeader
        title="Audit log"
        subtitle="Every administrator and system action, read-only"
        actions={
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => setTick((t) => t + 1)}>
            Refresh
          </Button>
        }
      />

      <Card flush>
        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <EmptyState
              title="Could not load audit logs"
              description={error}
              action={
                <Button variant="outline" onClick={() => setTick((t) => t + 1)}>
                  Try again
                </Button>
              }
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={rows?.items ?? []}
                getRowKey={(r) => r.id}
                emptyTitle="No audit entries"
                emptyDescription="Actions performed by administrators will appear here."
              />
              <Pagination
                page={page}
                totalPages={totalPages}
                total={rows?.total}
                onChange={setPage}
              />
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
