import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, ShieldCheck } from 'lucide-react';
import { Button, Card, Field, PageHeader, Textarea, useToast } from '@/components';
import { createDeviceReplacement } from '@/services/api';
import { ApiError } from '@/types';

const TOKEN_KEY = 'hotspot_access_token';

function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

export function DeviceReplacementPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [token] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const deviceHint = localStorage.getItem('hotspot_device_hint');

  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<number | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!token) return;
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setReasonError('Please describe your reason (at least 5 characters).');
      return;
    }
    setReasonError(null);
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await createDeviceReplacement({
        token,
        reason: trimmed,
        newDeviceHint: deviceHint ?? undefined,
      });
      setRequestId(res.requestId);
      toast.success(res.message);
    } catch (err) {
      setSubmitError(apiDetail(err, 'Could not submit your request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  /* Not signed in — login-first (no token handling beyond the session key). */
  if (!token) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <PageHeader title="Device replacement" subtitle="Moving to a new phone or laptop?" />
        <Card>
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-electric-50 text-electric-600">
            <KeyRound size={22} aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-semibold text-slate-900">Sign in first</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            For your security, connect with your access token before requesting a device replacement.
          </p>
          <Button size="lg" block className="mt-4" onClick={() => navigate('/connect')}>
            Go to token login
          </Button>
          <p className="mt-3 text-center text-sm text-slate-500">
            Lost your token?{' '}
            <Link to="/buy" className="font-medium text-electric-600 hover:underline">
              Buy a package
            </Link>
          </p>
        </Card>
      </div>
    );
  }

  /* Submitted — pending admin approval. */
  if (requestId !== null) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <PageHeader title="Device replacement" />
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
            <CheckCircle2 size={26} aria-hidden />
          </span>
          <h2 className="mt-3 text-lg font-semibold text-green-900">
            Your request is pending administrator approval
          </h2>
          <p className="mt-1 text-sm font-medium text-green-800">Request #{requestId}</p>
          <p className="mt-2 text-sm leading-relaxed text-green-700">
            An administrator will verify and approve your request.
          </p>
        </div>

        <Button size="lg" block className="mt-4" onClick={() => navigate('/subscription')}>
          Back to my subscription
        </Button>
      </div>
    );
  }

  /* Form */
  return (
    <div className="mx-auto w-full max-w-lg">
      <PageHeader
        title="Request a device replacement"
        subtitle="Lost your phone or got a new device? Tell us what happened."
      />

      <Card>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <Field
            label="Why do you need a device replacement?"
            htmlFor="replacement-reason"
            required
            error={reasonError}
            hint="Describe what happened — at least 5 characters."
          >
            <Textarea
              id="replacement-reason"
              rows={4}
              placeholder="e.g. I bought a new phone and lost the old one."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError(null);
              }}
              error={!!reasonError}
            />
          </Field>

          {deviceHint && (
            <p className="mt-2 break-all text-xs text-slate-500">This device: {deviceHint}</p>
          )}

          <p className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            <ShieldCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-slate-400" />
            <span>
              Your access token stays on this device. An administrator reviews every request before your old
              device is unlinked.
            </span>
          </p>

          {submitError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
            >
              {submitError}
            </p>
          )}

          <Button type="submit" size="lg" block loading={submitting} className="mt-4">
            Submit request
          </Button>
          <Button
            variant="outline"
            block
            className="mt-3"
            disabled={submitting}
            onClick={() => navigate('/subscription')}
          >
            Back to my subscription
          </Button>
        </form>
      </Card>
    </div>
  );
}
