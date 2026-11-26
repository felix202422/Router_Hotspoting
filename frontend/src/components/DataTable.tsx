import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer; defaults to row[key] as string. */
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Hide this column's data line in the mobile card view. */
  hideOnMobile?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Rendered inside the table area when rows is empty (e.g. offline warning). */
  emptyAction?: ReactNode;
}

function defaultCell<T>(row: T, key: string): ReactNode {
  const v = (row as Record<string, unknown>)[key];
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Responsive data table: real <table> on ≥lg, stacked key/value cards below —
 * never horizontal scroll (NFR-01: "tables remain usable on small screens").
 * The card view runs to 1024px because dense admin tables (many columns)
 * overflow the 768px tablet width.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyTitle = 'No data yet',
  emptyDescription,
  emptyAction,
}: DataTableProps<T>) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  const alignClass = (a?: Column<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';

  return (
    <>
      {/* Desktop / tablet landscape */}
      <div className="hidden lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 font-semibold text-slate-600',
                    alignClass(c.align),
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-slate-100 transition-colors last:border-0',
                  onRowClick && 'cursor-pointer hover:bg-slate-50',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('px-4 py-3 text-slate-700', alignClass(c.align), c.className)}
                  >
                    {c.render ? c.render(row) : defaultCell(row, c.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <li key={getRowKey(row)}>
            <div
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              className={cn(
                'rounded-xl border border-slate-200 bg-white p-4 shadow-card',
                onRowClick && 'cursor-pointer active:bg-slate-50',
              )}
            >
              {columns.map((c, i) => {
                if (c.hideOnMobile) return null;
                const content = c.render ? c.render(row) : defaultCell(row, c.key);
                if (i === 0) {
                  return (
                    <p key={c.key} className="text-sm font-semibold text-slate-900">
                      {content}
                    </p>
                  );
                }
                return (
                  <div key={c.key} className="mt-2 flex items-start justify-between gap-3 text-sm">
                    <span className="shrink-0 text-slate-500">{c.header}</span>
                    <span className="min-w-0 break-words text-right font-medium text-slate-700">
                      {content}
                    </span>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
