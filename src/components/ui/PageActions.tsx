import { cn } from '@/lib/utils/cn';

interface PageActionsProps {
  children: React.ReactNode;
  className?: string;
  /** Визуально отделить от контента выше (расписание, списки…) */
  separated?: boolean;
}

export function PageActions({ children, className, separated }: PageActionsProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-3',
        separated && 'mt-2 border-t border-slate-100 pt-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
