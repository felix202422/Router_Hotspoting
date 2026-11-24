import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, ShoppingBag } from 'lucide-react';
import { Button, Card, Field, Input, PageHeader, useToast } from '@/components';
import { tokenLogin } from '@/services/api';
import { ApiError } from '@/types';
import { DEMO_TOKEN } from '@/config/brand';
import { cn } from '@/utils/cn';

const DEVICE_HINT_KEY = 'hotspot_device_hint';
const TOKEN_KEY = 'hotspot_access_token';
const MAX_ATTEMPTS = 5;

/** Browser device identity — generated once, reused for every login. */
function ensureDeviceHint(): string {
  const existing = localStorage.getItem(DEVICE_HINT_KEY);
  if (existing) return existing;
  const hint = crypto.randomUUID();
  localStorage.setItem(DEVICE_HINT_KEY, hint);
  return hint;
}

interface ServerError {
  status: number;
  detail: string;
}

export function TokenLoginPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [hasSubscription, setHasSubscription] = useState<'yes' | 'no' | null>(null);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<ServerError | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const remaining = Math.max(0, MAX_ATTEMPTS - attempts);

  async function handleConnect(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const raw = token.trim();
    if (!raw) {
      setTokenError('Enter your access token.');
      return;
    }
    setTokenError(null);
    setServerError(null);
    setSubmitting(true);
    try {
      await tokenLogin({ token: raw, deviceHint: ensureDeviceHint() });
      sessionStorage.setItem(TOKEN_KEY, raw);
      toast.success('Connected!');
      navigate('/subscription', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError({ status: err.status, detail: err.problem.detail ?? err.message });
        setAttempts((a) => a + 1);
      } else {
        setServerError({ status: 0, detail: 'Could not connect. Check your connection and try again.' });
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <PageHeader title="Connect with token" subtitle="Enter the access token you received by SMS." />

      {/* Question block (§1.3) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <p className="text-sm font-semibold text-slate-800">Already have an active subscription?</p>
        <div className="mt-3 grid gap-2">
          <button
            type="button"
            aria-pressed={hasSubscription === 'yes'}
            onClick={() => setHasSubscription('yes')}
            className={cn(
              'flex min-h-[44px] w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition',
              hasSubscription === 'yes'
                ? 'border-electric-600 bg-electric-50 text-electric-700 ring-1 ring-electric-600'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                hasSubscription === 'yes' ? 'border-electric-600' : 'border-slate-300',
              )}
            >
              {hasSubscription === 'yes' && <span className="h-2 w-2 rounded-full bg-electric-600" />}
            </span>
            Yes, I have a token
          </button>

          <button
            type="button"
            aria-pressed={hasSubscription === 'no'}
            onClick={() => setHasSubscription('no')}
            className={cn(
              'flex min-h-[44px] w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition',
              hasSubscription === 'no'
                ? 'border-electric-600 bg-electric-50 text-electric-700 ring-1 ring-electric-600'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                hasSubscription === 'no' ? 'border-electric-600' : 'border-slate-300',
              )}
            >
              {hasSubscription === 'no' && <span className="h-2 w-2 rounded-full bg-electric-600" />}
            </span>
            No, I want to buy a package
          </button>
        </div>
      </div>

      {hasSubscription === null && (
        <p className="mt-3 text-center text-sm text-slate-500">Select an option above to continue.</p>
      )}

      {hasSubscription === 'no' && (
        <Card className="mt-4">
          <p className="text-sm leading-relaxed text-slate-600">
            No problem — choose a package, pay with M-Pesa and your access token arrives by SMS in under a
            minute.
          </p>
          <Button
            size="lg"
            block
            className="mt-3"
            onClick={() => navigate('/buy')}
            icon={<ShoppingBag size={18} aria-hidden />}
          >
            Buy a package
          </Button>
        </Card>
      )}

      {hasSubscription === 'yes' && (
        <form onSubmit={(e) => void handleConnect(e)} className="mt-4">
          <Field label="Access token" htmlFor="access-token" error={tokenError} hint="Sent to you by SMS after payment.">
            <div className="relative">
              <Input
                id="access-token"
                type={showToken ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                placeholder="Enter your access token"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (tokenError) setTokenError(null);
                }}
                error={!!tokenError}
                inputSize="lg"
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? 'Hide token' : 'Show token'}
                className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-lg text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-electric-500"
              >
                {showToken ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
              </button>
            </div>
          </Field>

          {serverError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
            >
              <p>{serverError.detail}</p>
              {serverError.status === 409 && (
                <Link
                  to="/device-replacement"
                  className="mt-1.5 inline-flex font-semibold text-red-800 underline"
                >
                  Request a device replacement →
                </Link>
              )}
            </div>
          )}

          {attempts >= 2 && !submitting && (
            <p role="status" className="mt-2 text-sm font-medium text-amber-700">
              ⚠ {remaining} attempt{remaining === 1 ? '' : 's'} remaining
            </p>
          )}

          <Button type="submit" size="lg" block loading={submitting} className="mt-4" icon={<KeyRound size={18} aria-hidden />}>
            Connect
          </Button>

          <p className="mt-3 text-center text-xs text-slate-500">Demo token: {DEMO_TOKEN}</p>
        </form>
      )}

      {/* Helpful links */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-card">
        <Link
          to="/device-replacement"
          className="flex min-h-[44px] items-center justify-between gap-3 text-sm font-medium text-slate-700 hover:text-electric-600"
        >
          <span>Lost your phone? Request a device replacement</span>
          <span aria-hidden>→</span>
        </Link>
        <div className="my-1 h-px bg-slate-100" aria-hidden />
        <Link
          to="/buy"
          className="flex min-h-[44px] items-center justify-between gap-3 text-sm font-medium text-slate-700 hover:text-electric-600"
        >
          <span>Don’t have a subscription? Buy a package</span>
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
