import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSession } from '@/stores/session';
import { isStaffRole, ROLE_LABELS, type UserRole } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { getAccessCode } from '@/lib/supabase/client';
import { pullAllData } from '@/lib/offline/sync';

type Tab = 'participants' | 'announcements' | 'settings';

export function AdminPage() {
  const profile = useSession((s) => s.profile);
  const [tab, setTab] = useState<Tab>('participants');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  if (!profile || !isStaffRole(profile.role)) {
    return (
      <AppShell title="Админка">
        <Card><p>Доступ только для организаторов</p></Card>
      </AppShell>
    );
  }

  async function createParticipant() {
    setLoading(true);
    setResult('');
    try {
      const { data, error } = await supabase.rpc('admin_create_profile', {
        p_access_code: getAccessCode(),
        p_full_name: name,
        p_role: role,
      });
      if (error) throw error;
      const r = data as { ok: boolean; profile?: { access_code: string; full_name: string } };
      if (!r.ok) throw new Error('Не удалось создать');
      setResult(`Создан: ${r.profile!.full_name}, код: ${r.profile!.access_code}`);
      setName('');
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function publishAnnouncement() {
    setLoading(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: annTitle,
        body: annBody,
        priority: 'normal',
        created_by: profile!.id,
      });
      if (error) throw error;
      setAnnTitle('');
      setAnnBody('');
      setResult('Объявление опубликовано');
      await pullAllData();
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function toggleRain(enabled: boolean) {
    setLoading(true);
    try {
      const { error } = await supabase.rpc('set_rain_mode', {
        p_access_code: getAccessCode(),
        p_enabled: enabled,
      });
      if (error) throw error;
      setResult(enabled ? 'Дождевой режим включён' : 'Дождевой режим выключен');
      await pullAllData();
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'participants', label: 'Участники' },
    { id: 'announcements', label: 'Объявления' },
    { id: 'settings', label: 'Настройки' },
  ];

  return (
    <AppShell title="Админка">
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={tab === t.id ? 'primary' : 'secondary'}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {tab === 'participants' && (
          <Card className="space-y-3">
            <h3 className="font-semibold">Создать участника</h3>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия" />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3"
            >
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <Button fullWidth onClick={createParticipant} disabled={loading || !name.trim()}>
              Создать и сгенерировать код
            </Button>
          </Card>
        )}

        {tab === 'announcements' && (
          <Card className="space-y-3">
            <h3 className="font-semibold">Новое объявление</h3>
            <Input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Заголовок" />
            <textarea
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Текст"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 min-h-[100px]"
            />
            <Button fullWidth onClick={publishAnnouncement} disabled={loading || !annTitle || !annBody}>
              Опубликовать
            </Button>
          </Card>
        )}

        {tab === 'settings' && (
          <Card className="space-y-3">
            <h3 className="font-semibold">Дождевой режим</h3>
            <p className="text-sm text-slate-600">Переключает отображение резервных мест для всех участников.</p>
            <div className="flex gap-2">
              <Button onClick={() => toggleRain(true)} disabled={loading}>Включить</Button>
              <Button variant="secondary" onClick={() => toggleRain(false)} disabled={loading}>Выключить</Button>
            </div>
          </Card>
        )}

        {result && <p className="text-sm text-primary-700">{result}</p>}
      </div>
    </AppShell>
  );
}
