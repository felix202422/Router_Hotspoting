import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button, Card, Spinner, StatusBadge } from '@/components';
import { getSubscription } from '@/services/api';
import type { SubscriptionInfo } from '@/types';
import { ApiError } from '@/types';
import { formatDateTime, formatPhone, formatRemaining } from '@/utils/format';

const TOKEN_KEY = 'hotspot_access_token';

function secondsLeft(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-slate-900">{children}</dd>
    </div>
  );
}

export function SubscriptionPage() {
  const navigate = useNavigate();
  const [token] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirect, setRedirect] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    getSubscription(token)
      .then((data) => setInfo(data))
      .catch((e: unknown) => {
        setInfo(null);
        if (e instanceof ApiError) {
          /* invalid/expired token — clear the session and re-authenticate */
          sessionStorage.removeItem(TOKEN_KEY);
          setRedirect(true);
        } else {
          setLoadError('Could not load your subscription. Check your connection and try again.');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  /* Live countdown — recompute from endsAt every second. */
  const endsAt = info?.subscription.endsAt ?? null;
  useEffect(() => {
    if (!endsAt) return;
    setRemaining(secondsLeft(endsAt));
    const intervalId = window.setInterval(() => setRemaining(secondsLeft(endsAt)), 1000);
    return () => window.clearInterval(intervalId);
  }, [endsAt]);

  if (!token || redirect) return <Navigate to="/connect" replace />;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
          <p role="alert" className="text-sm font-medium text-red-700">
            {loadError}
          </p>
          <Button variant="outline" className="mt-3" onClick={load}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!info) return null;

  const sub = info.subscription;

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card title="My subscription" action={<StatusBadge status={sub.status} />}>
        <dl className="divide-y divide-slate-100">
          <InfoRow label="Package">{sub.packageName}</InfoRow>
          <InfoRow label="Phone">{formatPhone(info.customer.phoneE164)}</InfoRow>
          <InfoRow label="Started">{formatDateTime(sub.startsAt)}</InfoRow>
          <InfoRow label="Expires">{formatDateTime(sub.endsAt)}</InfoRow>
          <InfoRow label="Remaining">
            <span className="tabular-nums">{remaining === null ? '—' : formatRemaining(remaining)}</span>
          </InfoRow>
          <InfoRow label="Device">
            {info.device.registered ? 'This device ✓' : 'Not registered'}
          </InfoRow>
          <InfoRow label="Status">
            <StatusBadge status={sub.status} />
          </InfoRow>
        </dl>
      </Card>

      <div className="mt-5 space-y-3">
        <Button size="lg" block onClick={() => navigate('/buy')}>
          Buy another package
        </Button>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="outline" block onClick={() => navigate('/device-replacement')}>
            Request device replacement
          </Button>
          <Button variant="outline" block onClick={() => navigate('/connect')}>
            Connect another device
          </Button>
        </div>
      </div>
    </div>
  );
}
