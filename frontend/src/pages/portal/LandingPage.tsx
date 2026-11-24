import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, MessageCircle, Phone, ShoppingBag, Wifi } from 'lucide-react';
import { Button, Card, EmptyState, Spinner } from '@/components';
import { listPackages } from '@/services/api';
import type { Package } from '@/types';
import { ApiError } from '@/types';
import { BRAND } from '@/config/brand';
import { formatBytes, formatDuration, formatSpeed, formatTzs } from '@/utils/format';

/** Wireframe §1.1 — numbered "how it works" card. */
const HOW_IT_WORKS = [
  'Choose a package',
  'Pay with M-Pesa',
  'Get your token by SMS',
  'Connect — enjoy!',
];

export function LandingPage() {
  const navigate = useNavigate();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPackages = useCallback(() => {
    setLoading(true);
    setError(null);
    listPackages()
      .then((items) => setPackages(items))
      .catch((e: unknown) => {
        setPackages([]);
        setError(e instanceof ApiError ? e.message : 'Could not load packages. Please try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* Hero */}
      <section className="rounded-2xl bg-navy-900 px-5 py-7 text-center text-white shadow-card sm:px-6">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-electric-600">
          <Wifi size={24} aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Welcome to {BRAND.name}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-electric-100">{BRAND.tagline}</p>
      </section>

      {/* How it works */}
      <Card title="How it works" className="mt-4">
        <ol className="space-y-3">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-electric-600 text-sm font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-1 text-sm text-slate-700">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Packages */}
      <Card title="Popular packages" className="mt-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        )}

        {!loading && error && (
          <div className="py-6 text-center">
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
            <Button variant="outline" className="mt-3" onClick={loadPackages}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && packages.length === 0 && (
          <EmptyState
            title="No packages available"
            description="Packages will show up here as soon as they are configured."
          />
        )}

        {!loading && !error && packages.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {packages.map((pkg) => (
              <li key={pkg.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{pkg.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDuration(pkg.durationSeconds)} · {formatSpeed(pkg.maxDownloadKbps)} down
                  </p>
                  <p className="text-xs text-slate-500">
                    {pkg.dataAllowanceBytes === null ? 'Unlimited data' : `${formatBytes(pkg.dataAllowanceBytes)} data`}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-slate-900">TZS {formatTzs(pkg.priceTzs)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Primary CTAs */}
      <div className="mt-5 space-y-3">
        <Button size="lg" block onClick={() => navigate('/buy')} icon={<ShoppingBag size={18} aria-hidden />}>
          Buy a package
        </Button>
        <Button
          size="lg"
          block
          variant="outline"
          onClick={() => navigate('/connect')}
          icon={<KeyRound size={18} aria-hidden />}
        >
          I have a token
        </Button>
      </div>

      {/* Existing subscription (§1.1) */}
      <Card title="Already have an active subscription?" className="mt-5">
        <p className="text-sm text-slate-600">
          Reconnect with your access token, or choose a new package and pay with M-Pesa.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => navigate('/connect')}>
            Yes
          </Button>
          <Button variant="outline" onClick={() => navigate('/buy')}>
            No
          </Button>
        </div>
      </Card>

      {/* Support */}
      <Card title="Support" className="mt-5">
        <div className="space-y-2 text-sm text-slate-600">
          <p className="flex items-center gap-2">
            <Phone size={16} aria-hidden className="shrink-0 text-slate-400" />
            <a href={`tel:${BRAND.supportPhone.replace(/\s/g, '')}`} className="font-medium text-electric-600 hover:underline">
              {BRAND.supportPhone}
            </a>
          </p>
          <p className="flex items-center gap-2">
            <MessageCircle size={16} aria-hidden className="shrink-0 text-slate-400" />
            <span className="font-medium text-electric-600">WhatsApp {BRAND.whatsappPhone}</span>
          </p>
          <p className="text-xs text-slate-500">{BRAND.supportHours}</p>
          <p className="text-xs text-slate-500">{BRAND.location}</p>
        </div>
      </Card>
    </div>
  );
}
