import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import type { ComponentProps } from 'react';

type ButtonVariant = ComponentProps<typeof Button>['variant'];

interface ButtonLinkProps {
  to: string;
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
}

/** Ссылка-кнопка: block-обёртка, чтобы отступы между блоками работали предсказуемо. */
export function ButtonLink({ to, children, variant = 'primary', className }: ButtonLinkProps) {
  return (
    <Link to={to} className={cn('block w-full', className)}>
      <Button variant={variant} fullWidth>
        {children}
      </Button>
    </Link>
  );
}
