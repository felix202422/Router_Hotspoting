import { useCallback, useEffect, useState } from 'react';
import type { Column } from '@/components';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageHeader,
  Spinner,
  useToast,
} from '@/components';
import { disconnectSession, getNetworkHealth, listNetworkSessions } from '@/services/api';
import type { NetworkHealth, NetworkSession } from '@/types';
import { ApiError } from '@/types';
import { formatBytes, formatDateTime, formatPhone, formatSessionDuration } from '@/utils/format';
import { Activity, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

const REFRESH_MS = 15_000;

/**
 * Network management (FR-D06/D07): shows ONLY what the connected controller
 * reports. When unreachable, it says so honestly — no fabricated data.
 */
export function NetworkPage() {
  const toast = useToast();

  const [health, setHealth] = useState<NetworkHealth | null>(null);
  const [sessions, setSessions] = useState<NetworkSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [pending, setPending] = useState<NetworkSession | null>(null);
  const [confirming, setConfirming] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([getNetworkHealth(), listNetworkSessions()]);
      setHealth(h);
      setSessions(s);
      setError(null);
    } catch (e) {
      setError(apiDetail(e, 'Could not load network state.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) void refresh();
    };
    run();
    const id = window.setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refresh, tick]);

  const handleDisconnect = async () => {
    if (!pending) return;
    setConfirming(true);
    try {
      await disconnectSession(pending.grantRef);
      toast.success(`Disconnected ${pending.ipAddress}`);
      setPending(null);
      setTick((t) => t + 1);
    } catch (e) {
      toast.error(apiDetail(e, 'Failed to disconnect session.'));
    } finally {
      setConfirming(false);
    }
  };

  const lastSyncRelative = (iso: string | null): string => {
    if (!iso) return 'never';
    const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
    return `${Math.round(secs / 3600)}h ago`;
  };

  const columns: Column<NetworkSession>[] = [
    { key: 'ipAddress', header: 'IP address', render: (r) => <span className="font-mono text-xs">{r.ipAddress}</span> },
    { key: 'deviceIdentifier', header: 'Device', render: (r) => <span className="font-mono text-xs">{r.deviceIdentifier}</span>, hideOnMobile: false },
    { key: 'phoneE164', header: 'Customer', render: (r) => formatPhone(r.phoneE164) },
    { key: 'packageName', header: 'Package' },
    { key: 'connectedAt', header: 'Connected', render: (r) => formatDateTime(r.connectedAt) },
    { key: 'durationSeconds', header: 'Duration', render: (r) => formatSessionDuration(r.durationSeconds) },
    {
      key: 'usage',
      header: 'Usage',
      align: 'right',
      render: (r) => formatBytes(r.bytesIn + r.bytesOut),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setPending(r);
          }}
        >
          Disconnect
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Network"
        subtitle="Live sessions reported by the hotspot controller"
        actions={
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={() => setTick((t) => t + 1)}>
            Refresh
          </Button>
        }
      />

      {/* Controller health */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                health?.reachable ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {health?.reachable ? <ShieldCheck size={20} /> : <WifiOff size={20} />}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {health?.controller ?? '—'} {health?.reachable ? 'reachable' : 'unreachable'}
              </p>
              <p className="text-xs text-slate-500">Last sync: {lastSyncRelative(health?.lastSyncAt ?? null)}</p>
            </div>
          </div>

          <Badge tone="success" dot>
            Enforcement ON
          </Badge>

          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Activity size={16} className="text-leaf-600" aria-hidden />
            <span>
              <strong>{sessions.length}</strong> active session{sessions.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="text-sm text-slate-600">
            Drift: <strong>{health?.drift ?? 0}</strong> {health?.drift === 1 ? 'entry' : 'entries'}
          </div>
        </div>

        {health && !health.reachable && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
          >
            Controller unreachable — live session data unavailable. No data is fabricated; the table
            below reflects the last known state only.
          </div>
        )}
      </Card>

      {/* Sessions */}
      <Card title="Connected devices" flush>
        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : error ? (
            <EmptyState
              title="Could not load sessions"
              description={error}
              action={
                <Button variant="outline" onClick={() => setTick((t) => t + 1)}>
                  Try again
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              rows={sessions}
              getRowKey={(r) => r.grantRef}
              emptyTitle={health?.reachable ? 'No active sessions' : 'No session data'}
              emptyDescription={
                health?.reachable
                  ? 'No customer devices are connected right now.'
                  : 'The controller is offline — sessions will appear once it reconnects.'
              }
            />
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={!!pending}
        title="Disconnect session?"
        message={`This will immediately terminate the connection for ${pending?.ipAddress ?? ''} (${formatPhone(
          pending?.phoneE164 ?? '',
        )}). The customer can reconnect while their subscription remains active.`}
        confirmLabel="Disconnect"
        danger
        loading={confirming}
        onConfirm={handleDisconnect}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
