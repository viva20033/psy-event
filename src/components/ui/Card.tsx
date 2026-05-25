import { cn } from '@/lib/utils/cn';
import type { HTMLAttributes } from 'react';

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-white shadow-sm border border-slate-100 p-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
