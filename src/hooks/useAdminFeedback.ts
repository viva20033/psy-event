import { useCallback, useRef, useState } from 'react';

export type AdminFeedback = { type: 'ok' | 'err'; text: string } | null;

/** Преобразует ошибку Supabase в понятный текст */
export function formatSaveError(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const msg = String((e as { message: string }).message);
    if (msg.includes('JWT') || msg.includes('permission') || msg.includes('policy')) {
      return `${msg} — проверьте, что вы вошли как организатор/админ и обновите страницу.`;
    }
    if (msg.includes('image_url') && msg.includes('announcements')) {
      return (
        'В базе нет колонки для картинок объявлений. В Supabase → SQL Editor выполните файл ' +
        'supabase/migrations/004_announcements_push.sql (или: ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url text;), ' +
        'подождите 10–20 секунд и попробуйте снова.'
      );
    }
    return msg;
  }
  return e instanceof Error ? e.message : 'Не удалось сохранить';
}

export function useAdminFeedback() {
  const [feedback, setFeedback] = useState<AdminFeedback>(null);
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);

  const run = useCallback(async (successText: string, action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setFeedback(null);
    try {
      await action();
      setFeedback({ type: 'ok', text: successText });
    } catch (e) {
      setFeedback({ type: 'err', text: formatSaveError(e) });
      throw e;
    } finally {
      setSaving(false);
      busyRef.current = false;
    }
  }, []);

  return { feedback, setFeedback, saving, run };
}
