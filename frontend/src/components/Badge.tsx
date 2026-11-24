import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONES: Record<Tone, string> = {
  success: 'bg-green-50 text-green-700 border-green-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-electric-50 text-electric-700 border-electric-100',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
};

const DOTS: Record<Tone, string> = {
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-electric-500',
  neutral: 'bg-slate-400',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ tone = 'neutral', dot = false, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}

/* Status string → tone + label (§14 colour semantics) */
const STATUS_MAP: Record<string, { tone: Tone; label: string }> = {
  ACTIVE: { tone: 'success', label: 'Active' },
  SUCCESS: { tone: 'success', label: 'Success' },
  APPROVED: { tone: 'success', label: 'Approved' },
  CONNECTED: { tone: 'success', label: 'Connected' },
  DELIVERED: { tone: 'success', label: 'Delivered' },
  PENDING: { tone: 'warning', label: 'Pending' },
  QUEUED: { tone: 'warning', label: 'Queued' },
  SENT: { tone: 'warning', label: 'Sent' },
  ENFORCEMENT_PENDING: { tone: 'warning', label: 'Enforcement pending' },
  FAILED: { tone: 'danger', label: 'Failed' },
  REJECTED: { tone: 'danger', label: 'Rejected' },
  REVOKED: { tone: 'danger', label: 'Revoked' },
  EXPIRED: { tone: 'danger', label: 'Expired' },
  REFUNDED: { tone: 'info', label: 'Refunded' },
  SUSPENDED: { tone: 'neutral', label: 'Suspended' },
  INACTIVE: { tone: 'neutral', label: 'Inactive' },
  REMOVED: { tone: 'neutral', label: 'Removed' },
  DISABLED: { tone: 'neutral', label: 'Disabled' },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = STATUS_MAP[status] ?? { tone: 'neutral' as Tone, label: status };
  return (
    <Badge tone={entry.tone} dot className={className}>
      {entry.label}
    </Badge>
  );
}
