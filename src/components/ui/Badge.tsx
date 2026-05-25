import { cn } from '@/lib/utils/cn';
import type { AnnouncementPriority } from '@/types';

const styles: Record<AnnouncementPriority, string> = {
  normal: 'bg-slate-50 border-slate-200 text-slate-800',
  important: 'bg-amber-50 border-amber-200 text-amber-900',
  urgent: 'bg-red-50 border-red-300 text-red-900',
};

const labels: Record<AnnouncementPriority, string> = {
  normal: 'Объявление',
  important: 'Важно',
  urgent: 'Срочно',
};

interface BadgeProps {
  priority: AnnouncementPriority;
  className?: string;
}

export function PriorityBadge({ priority, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-block rounded-full border px-2 py-0.5 text-xs font-semibold uppercase',
        styles[priority],
        className,
      )}
    >
      {labels[priority]}
    </span>
  );
}
