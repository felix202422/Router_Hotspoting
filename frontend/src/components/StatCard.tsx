import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card } from './Card';

const TONES = {
  default: 'text-slate-900',
  success: 'text-green-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
} as const;

export interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  tone?: keyof typeof TONES;
  icon?: LucideIcon;
}

/** Dashboard KPI card (§10 overview). */
export function StatCard({ label, value, sub, trend, tone = 'default', icon: Icon }: StatCardProps) {
  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn('mt-1 truncate text-2xl font-bold tracking-tight', TONES[tone])}>{value}</p>
          {sub && <p className="mt-1 truncate text-xs text-slate-500">{sub}</p>}
          {trend && <p className="mt-1 truncate text-xs font-medium text-green-600">{trend}</p>}
        </div>
        {Icon && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-leaf-50 text-leaf-600">
            <Icon size={20} aria-hidden />
          </span>
        )}
      </div>
    </Card>
  );
}
