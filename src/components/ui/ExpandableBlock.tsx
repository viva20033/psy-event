import { cn } from '@/lib/utils/cn';

interface ExpandableBlockProps {
  open: boolean;
  onToggle: () => void;
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** Строка-заголовок + раскрываемый блок (аккордеон внутри списка). */
export function ExpandableBlock({
  open,
  onToggle,
  label,
  children,
  className,
  headerClassName,
}: ExpandableBlockProps) {
  return (
    <div className={cn('overflow-hidden', className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center justify-between gap-2 text-left',
          headerClassName,
        )}
      >
        <span className="min-w-0 flex-1">{label}</span>
        <Chevron open={open} />
      </button>
      {open && <div className="pt-3">{children}</div>}
    </div>
  );
}
