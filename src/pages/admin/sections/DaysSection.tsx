import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/admin/FormField';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { useAdminData } from '@/stores/adminData';
import { supabase } from '@/lib/supabase/client';
import type { EventDay } from '@/types';

export function DaysSection() {
  const { feedback, saving, run } = useAdminFeedback();
  const eventDays = useAdminData((s) => s.eventDays);
  const loading = useAdminData((s) => s.loading.eventDays);
  const ensureEventDays = useAdminData((s) => s.ensureEventDays);
  const patchEventDay = useAdminData((s) => s.patchEventDay);

  const [editing, setEditing] = useState<EventDay | null>(null);
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [isRest, setIsRest] = useState(false);

  useEffect(() => {
    void ensureEventDays();
  }, [ensureEventDays]);

  function openEdit(d: EventDay) {
    setEditing(d);
    setLabel(d.label);
    setDate(d.event_date ?? '');
    setIsRest(d.is_rest_day);
  }

  async function save() {
    if (!editing) return;
    const id = editing.id;
    const patch = {
      label: label.trim(),
      event_date: date || null,
      is_rest_day: isRest,
    };
    patchEventDay(id, patch);
    setEditing(null);
    await run('День сохранён', async () => {
      const { error } = await supabase.from('event_days').update(patch).eq('id', id);
      if (error) {
        void ensureEventDays(true);
        throw error;
      }
    });
  }

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />

      {loading && eventDays.length === 0 ? (
        <p className="text-center text-slate-500 py-6">Загрузка дней…</p>
      ) : (
        <ul className="space-y-2">
          {eventDays.map((d) => (
            <li key={d.id}>
              <Card className="flex justify-between items-center gap-2 py-3">
                <div>
                  <p className="font-medium">{d.label}</p>
                  <p className="text-xs text-slate-500">
                    {d.event_date ?? 'дата не указана'}
                    {d.is_rest_day ? ' · выходной' : ''}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => openEdit(d)}>
                  Изменить
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg space-y-3">
            <h3 className="font-semibold">День: {editing.label}</h3>
            <FormField label="Название">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </FormField>
            <FormField label="Дата">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isRest} onChange={(e) => setIsRest(e.target.checked)} />
              Выходной
            </label>
            <Button fullWidth onClick={save} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
            <Button fullWidth variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Отмена
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
