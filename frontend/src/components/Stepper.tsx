import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface StepperProps {
  steps: string[];
  current: number; // 0-based
}

/** Purchase flow progress (portal). Mobile: compact "Step x of n". */
export function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="w-full">
      {/* Full labels on ≥sm */}
      <ol className="hidden sm:flex sm:items-center sm:gap-2" aria-label="Progress">
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors',
                i < current && 'bg-green-100 text-green-700',
                i === current && 'bg-leaf-600 text-white',
                i > current && 'bg-slate-100 text-slate-400',
              )}
              aria-current={i === current ? 'step' : undefined}
            >
              {i < current ? <Check size={16} /> : i + 1}
            </span>
            <span
              className={cn(
                'text-sm font-medium',
                i === current ? 'text-slate-900' : 'text-slate-500',
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-slate-200" aria-hidden />}
          </li>
        ))}
      </ol>
      {/* Mobile: compact */}
      <div className="flex items-center gap-3 sm:hidden">
        <span className="text-sm font-semibold text-slate-900">
          Step {current + 1}/{steps.length}
        </span>
        <span className="text-sm text-slate-500">{steps[current]}</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <span
            className="block h-full rounded-full bg-leaf-600 transition-all"
            style={{ width: `${((current + 1) / steps.length) * 100}%` }}
          />
        </span>
      </div>
    </div>
  );
}
