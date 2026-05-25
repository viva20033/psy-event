import type { AdminFeedback } from '@/hooks/useAdminFeedback';

export function AdminStatusBanner({ feedback }: { feedback: AdminFeedback }) {
  if (!feedback) return null;

  return (
    <div
      className={`rounded-xl px-4 py-3 text-sm font-medium ${
        feedback.type === 'ok'
          ? 'bg-green-100 text-green-900 border border-green-200'
          : 'bg-red-100 text-red-900 border border-red-200'
      }`}
      role="alert"
    >
      {feedback.text}
    </div>
  );
}
