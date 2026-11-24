import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Users,
  Wifi,
  X,
  CalendarClock,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/features/auth/AuthContext';
import { Badge } from '@/components';
import { BRAND } from '@/config/brand';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/packages', label: 'Packages', icon: Package },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CalendarClock },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/network', label: 'Network', icon: Wifi },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
];

function NavItems({ onNavigate, compact }: { onNavigate?: () => void; compact?: boolean }) {
  return (
    <nav className="flex-1 space-y-1 px-2 py-3" aria-label="Admin navigation">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={compact ? label : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-electric-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-navy-800 hover:text-white',
            )
          }
        >
          <Icon size={18} className="shrink-0" aria-hidden />
          <span className={cn('truncate', compact && 'sr-only')}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function BrandRow({ compact }: { compact?: boolean }) {
  return (
    <div className="flex h-16 items-center gap-2.5 border-b border-navy-700 px-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-electric-600 text-white">
        <Wifi size={18} aria-hidden />
      </span>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{BRAND.name}</p>
          <p className="truncate text-[11px] text-slate-400">Admin console</p>
        </div>
      )}
    </div>
  );
}

/**
 * Admin shell — desktop-first (§13):
 * ≥1280px expanded sidebar · 1024–1279px icon rail · <1024px hamburger drawer.
 */
export function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar: icon rail at lg, expanded at xl */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden flex-col bg-navy-900 lg:flex lg:w-16 xl:w-60">
        <BrandRow compact />
        <NavItems compact />
        <div className="border-t border-navy-700 p-2">
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-navy-800 hover:text-white"
          >
            <LogOut size={18} className="shrink-0" aria-hidden />
            <span className="hidden xl:inline">Log out</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-navy-950/50 animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-navy-900 shadow-drawer animate-fade-in">
            <div className="flex items-center justify-between pr-3">
              <BrandRow />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-navy-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            <NavItems onNavigate={() => setDrawerOpen(false)} />
            <div className="border-t border-navy-700 p-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-navy-800 hover:text-white"
              >
                <LogOut size={18} aria-hidden /> Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="lg:ml-16 xl:ml-60">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu size={18} />
            </button>
            <p className="truncate text-sm font-semibold text-slate-800 sm:text-base">
              {BRAND.name} <span className="hidden font-normal text-slate-400 sm:inline">· Admin</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden sm:block">
              <Badge tone="success" dot>
                Enforcement ON
              </Badge>
            </span>
            <div className="flex items-center gap-2">
              <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-sm font-bold text-white sm:flex">
                {profile?.fullName?.charAt(0) ?? 'A'}
              </span>
              <div className="hidden min-w-0 leading-tight md:block">
                <p className="truncate text-sm font-medium text-slate-800">{profile?.fullName}</p>
                <p className="truncate text-xs text-slate-500">{profile?.role}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
