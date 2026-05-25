import { cn } from '@/lib/utils/cn';
import type { InputHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg',
        'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200',
        className,
      )}
      {...props}
    />
  );
}
