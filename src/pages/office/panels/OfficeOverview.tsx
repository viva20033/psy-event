import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase/client';

interface Stats {
  profiles: number;
  groups: number;
  connectionsPending: number;
  connectionsConfirmed: number;
  trainers: number;
  scheduleEvents: number;
}

export function OfficeOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [p, g, cp, cc, t, s] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('groups').select('id', { count: 'exact', head: true }),
          supabase.from('connections').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('connections').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
          supabase.from('intensive_trainers').select('id', { count: 'exact', head: true }).eq('is_visible', true),
          supabase.from('schedule_events').select('id', { count: 'exact', head: true }),
        ]);
        if (p.error) throw p.error;
        if (g.error) throw g.error;
        if (cp.error) throw cp.error;
        if (cc.error) throw cc.error;
        if (t.error) throw t.error;
        if (s.error) throw s.error;
        setStats({
          profiles: p.count ?? 0,
          groups: g.count ?? 0,
          connectionsPending: cp.count ?? 0,
          connectionsConfirmed: cc.count ?? 0,
          trainers: t.count ?? 0,
          scheduleEvents: s.count ?? 0,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      }
    }
    void load();
  }, []);

  if (error) {
    return <Card className="text-red-700 text-sm">{error}</Card>;
  }

  if (!stats) {
    return <p className="text-slate-500 text-sm">Загрузка статистики…</p>;
  }

  const tiles = [
    { label: 'Активных участников', value: stats.profiles },
    { label: 'Групп', value: stats.groups },
    { label: 'Связей (ожидают)', value: stats.connectionsPending },
    { label: 'Связей (подтверждены)', value: stats.connectionsConfirmed },
    { label: 'Тренеров в справочнике', value: stats.trainers },
    { label: 'Событий в расписании', value: stats.scheduleEvents },
  ];

  return (
    <div className="space-y-4">
      <Card className="bg-primary-50 border-primary-100">
        <p className="text-sm text-primary-900">
          Рабочий стол организатора. Участники по-прежнему пользуются обычным приложением — здесь
          только ваши инструменты на большом экране.
        </p>
        <p className="text-xs text-primary-700 mt-2">
          Закладка: <strong>/office</strong> (в меню приложения ссылки нет)
        </p>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => (
          <Card key={t.label} className="text-center py-4">
            <p className="text-3xl font-bold text-primary-800">{t.value}</p>
            <p className="text-sm text-slate-600 mt-1">{t.label}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
