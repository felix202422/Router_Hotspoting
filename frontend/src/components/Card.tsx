import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  action?: ReactNode;
  /** Remove default padding when card holds a table/full-bleed child. */
  flush?: boolean;
}

export function Card({ title, action, flush = false, className, children, ...rest }: CardProps) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-card', className)} {...rest}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          {typeof title === 'string' ? <h2 className="text-base font-semibold">{title}</h2> : title}
          {action}
        </div>
      )}
      <div className={flush ? '' : 'p-4 sm:p-5'}>{children}</div>
    </div>
  );
}
