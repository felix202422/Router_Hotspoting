import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Wifi } from 'lucide-react';
import { Button, Field, Input } from '@/components';
import { useAuth } from '@/features/auth/AuthContext';
import { BRAND, MOCK_ADMIN } from '@/config/brand';
import { ApiError } from '@/types';

/** Inline error — never toast-only (§14 clear feedback). */
function apiDetail(e: unknown, fallback: string): string {
  return e instanceof ApiError ? (e.problem.detail ?? e.message) : fallback;
}

export function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Where RequireAuth sent us before bouncing to login. */
  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiDetail(err, 'Unable to sign in. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-forest-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-citrus-500 text-forest-900 shadow-sm">
            <Wifi size={24} aria-hidden />
          </span>
          <h1 className="mt-3 text-xl font-bold text-white">{BRAND.name}</h1>
          <p className="text-sm text-slate-400">Admin console</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-card"
        >
          <h2 className="text-base font-semibold text-slate-900">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Administrator access only.</p>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
            >
              {error}
            </p>
          )}

          <div className="mt-4 space-y-4">
            <Field label="Email" htmlFor="admin-email" required>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" htmlFor="admin-password" required>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
          </div>

          <div className="mt-5">
            <Button type="submit" variant="primary" size="lg" block loading={loading}>
              Sign in
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            {`Demo: ${MOCK_ADMIN.email} / ${MOCK_ADMIN.password}`}
          </p>
        </form>
      </div>
    </div>
  );
}
