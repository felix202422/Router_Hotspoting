import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  total?: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex flex-col items-center justify-between gap-3 pt-4 sm:flex-row" aria-label="Pagination">
      <p className="order-2 text-xs text-slate-500 sm:order-1">
        Page {page} of {totalPages}
        {total !== undefined && ` · ${total} total`}
      </p>
      <div className="order-1 flex gap-2 sm:order-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          icon={<ChevronLeft size={16} />}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          icon={<ChevronRight size={16} className="ml-1" />}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
