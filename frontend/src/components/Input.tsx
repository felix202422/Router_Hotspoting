import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/utils/cn';

const CONTROL =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-leaf-500 focus:outline-none focus:ring-2 focus:ring-leaf-100 disabled:bg-slate-50 disabled:text-slate-500';

const ERROR = 'border-red-400 focus:border-red-500 focus:ring-red-100';

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/** Label + control + error/hint wrapper (NFR-01 accessible forms). */
export function Field({ label, htmlFor, error, hint, required, children, className }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
      {!error && hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  inputSize?: 'md' | 'lg';
}

export function Input({ error, inputSize = 'md', className, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        CONTROL,
        inputSize === 'lg' && 'h-12 text-base',
        inputSize === 'md' && 'h-11',
        error && ERROR,
        className,
      )}
      aria-invalid={error || undefined}
      {...rest}
    />
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(CONTROL, 'min-h-[96px] py-2.5', error && ERROR, className)}
      aria-invalid={error || undefined}
      {...rest}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={cn(CONTROL, 'h-11 cursor-pointer appearance-none bg-no-repeat pr-9', error && ERROR, className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.7rem center',
      }}
      {...rest}
    >
      {children}
    </select>
  );
}
