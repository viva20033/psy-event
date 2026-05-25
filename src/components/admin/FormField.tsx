import { cn } from '@/lib/utils/cn';
import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({ label, hint, children, className }: FormFieldProps) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-sm font-medium text-slate-800">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 leading-snug">{hint}</span>}
    </label>
  );
}

export const adminSelectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base min-h-[48px]';

export const adminTextareaClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base min-h-[88px]';
