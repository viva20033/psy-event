import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/admin/FormField';
import { supabase } from '@/lib/supabase/client';
import { getAccessCode } from '@/lib/supabase/client';
import { refreshAppData } from '@/services/admin';
import type { AdminSectionProps } from '../types';

export function SettingsSection({
  showMessage,
  showError,
  loading,
  setLoading,
}: AdminSectionProps) {
  const [rainMode, setRainMode] = useState(false);
  const [phone, setPhone] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('event_settings').select('*');
    if (error) throw error;
    for (const row of data ?? []) {
      if (row.key === 'rain_mode') setRainMode(row.value === true || row.value === 'true');
      if (row.key === 'organizer_contact') {
        const v = row.value;
        if (typeof v === 'string') setPhone(v);
        else if (typeof v === 'object' && v !== null) setPhone(String(v));
        else setPhone(String(v ?? '').replace(/^"|"$/g, ''));
      }
    }
  }, []);

  useEffect(() => {
    load().catch((e) => showError(e instanceof Error ? e.message : 'Ошибка'));
  }, [load, showError]);

  async function toggleRain(enabled: boolean) {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('set_rain_mode', {
        p_access_code: getAccessCode(),
        p_enabled: enabled,
      });
      if (error) throw error;
      const r = data as { ok: boolean };
      if (!r.ok) throw new Error('Нет доступа');
      setRainMode(enabled);
      await refreshAppData();
      showMessage(enabled ? 'Дождевой режим включён — везде запасные места' : 'Дождевой режим выключен');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function savePhone() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('event_settings')
        .update({ value: phone.trim(), updated_at: new Date().toISOString() })
        .eq('key', 'organizer_contact');
      if (error) throw error;
      await refreshAppData();
      showMessage('Контакт организатора сохранён');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h3 className="font-semibold text-lg">Дождевой режим</h3>
        <p className="text-sm text-slate-600">
          Одна кнопка для всех: в расписании и на экране «Я потерялся» показываются{' '}
          <strong>запасные</strong> места. Включайте, когда пошёл дождь.
        </p>
        <p className="text-sm font-medium">
          Сейчас: {rainMode ? 'включён ☔' : 'выключен'}
        </p>
        <div className="flex gap-2">
          <Button fullWidth onClick={() => toggleRain(true)} disabled={loading || rainMode}>
            Включить дождь
          </Button>
          <Button fullWidth variant="secondary" onClick={() => toggleRain(false)} disabled={loading || !rainMode}>
            Выключить
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold text-lg">Контакт организатора</h3>
        <p className="text-sm text-slate-600">
          Показывается на экране «Я потерялся», если человек не знает, куда идти.
        </p>
        <FormField label="Телефон">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 ..." />
        </FormField>
        <Button fullWidth onClick={savePhone} disabled={loading}>
          Сохранить телефон
        </Button>
      </Card>

      <Card className="text-sm text-slate-600 space-y-2">
        <p className="font-medium text-slate-800">Порядок заполнения (подсказка)</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Места на территории</li>
          <li>Дни — указать даты</li>
          <li>Группы и участники</li>
          <li>Расписание по дням</li>
          <li>Коды входа участникам</li>
        </ol>
      </Card>
    </div>
  );
}
