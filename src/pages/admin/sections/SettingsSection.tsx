import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/admin/FormField';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { supabase } from '@/lib/supabase/client';
import { getAccessCode } from '@/lib/supabase/client';

export function SettingsSection() {
  const { feedback, saving, run } = useAdminFeedback();
  const [rainMode, setRainMode] = useState(false);
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('event_settings').select('*');
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.key === 'rain_mode') setRainMode(row.value === true || row.value === 'true');
      if (row.key === 'organizer_contact') {
        const v = row.value;
        if (typeof v === 'string') setPhone(v.replace(/^"|"$/g, ''));
        else setPhone(String(v ?? ''));
      }
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function toggleRain(enabled: boolean) {
    await run(
      enabled ? 'Дождевой режим включён' : 'Дождевой режим выключен',
      async () => {
        const { data, error } = await supabase.rpc('set_rain_mode', {
          p_access_code: getAccessCode(),
          p_enabled: enabled,
        });
        if (error) throw error;
        const r = data as { ok: boolean };
        if (!r.ok) throw new Error('Нет доступа');
        setRainMode(enabled);
      },
    );
  }

  async function savePhone() {
    await run('Телефон сохранён', async () => {
      const { error } = await supabase
        .from('event_settings')
        .update({ value: phone.trim(), updated_at: new Date().toISOString() })
        .eq('key', 'organizer_contact');
      if (error) throw error;
    });
  }

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />

      <Card className="space-y-3">
        <h3 className="font-semibold text-lg">Дождевой режим</h3>
        <p className="text-sm text-slate-600">
          Сейчас: <strong>{rainMode ? 'включён ☔' : 'выключен'}</strong>
        </p>
        <div className="flex gap-2">
          <Button fullWidth onClick={() => toggleRain(true)} disabled={saving || rainMode}>
            Включить
          </Button>
          <Button fullWidth variant="secondary" onClick={() => toggleRain(false)} disabled={saving || !rainMode}>
            Выключить
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold text-lg">Контакт организатора</h3>
        <FormField label="Телефон">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 ..." />
        </FormField>
        <Button fullWidth onClick={savePhone} disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить телефон'}
        </Button>
      </Card>
    </div>
  );
}
