import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Да, удалить',
  onConfirm,
  onCancel,
  loading,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <Card className="w-full max-w-sm space-y-4 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex flex-col gap-2">
          <Button variant="danger" fullWidth onClick={onConfirm} disabled={loading}>
            {loading ? 'Подождите…' : confirmLabel}
          </Button>
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={loading}>
            Отмена
          </Button>
        </div>
      </Card>
    </div>
  );
}
