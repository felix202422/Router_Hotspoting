import { Outlet, Link } from 'react-router-dom';
import { Wifi } from 'lucide-react';
import { BRAND } from '@/config/brand';

/**
 * Customer portal shell — mobile-first (§13).
 * Navy header + centered content + support footer.
 */
export function PortalLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-navy-900 text-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label={`${BRAND.name} home`}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-electric-600">
              <Wifi size={18} aria-hidden />
            </span>
            <span className="truncate text-base font-bold tracking-tight">{BRAND.name}</span>
          </Link>
          <a
            href={`tel:${BRAND.supportPhone.replace(/\s/g, '')}`}
            className="shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-electric-100 transition hover:bg-navy-800 hover:text-white"
          >
            Support
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs leading-relaxed text-slate-500">
          <p className="font-medium text-slate-600">{BRAND.name} — {BRAND.location}</p>
          <p className="mt-1">
            Support: {BRAND.supportPhone} · {BRAND.supportHours}
          </p>
          <p className="mt-1">Payments secured by M-Pesa. Tokens are never shared with anyone.</p>
        </div>
      </footer>
    </div>
  );
}
