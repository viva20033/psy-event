import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { supabase } from '@/lib/supabase/client';
import {
  CONNECTION_TYPE_LABELS,
  GROUP_TYPE_LABELS,
  type Connection,
  type Group,
  type Profile,
} from '@/types';

export function OfficeConnectionsPanel() {
  const { feedback, saving, run, setFeedback } = useAdminFeedback();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('all');

  const load = useCallback(async () => {
    const [c, p, g] = await Promise.all([
      supabase.from('connections').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, role'),
      supabase.from('groups').select('id, name, group_type'),
    ]);
    if (c.error) throw c.error;
    if (p.error) throw p.error;
    if (g.error) throw g.error;
    setConnections((c.data ?? []) as Connection[]);
    const pm: Record<string, Profile> = {};
    for (const row of p.data ?? []) pm[row.id] = row as Profile;
    setProfiles(pm);
    const gm: Record<string, Group> = {};
    for (const row of g.data ?? []) gm[row.id] = row as Group;
    setGroups(gm);
  }, []);

  useEffect(() => {
    load().catch((e) =>
      setFeedback({ type: 'err', text: e instanceof Error ? e.message : 'Ошибка' }),
    );
  }, [load, setFeedback]);

  const filtered = connections.filter((c) =>
    filter === 'all' ? true : c.status === filter,
  );

  function describe(c: Connection): string {
    const req = profiles[c.requester_id]?.full_name ?? c.requester_id.slice(0, 8);
    const type = CONNECTION_TYPE_LABELS[c.connection_type];
    if (c.target_profile_id) {
      const tgt = profiles[c.target_profile_id]?.full_name ?? '—';
      return `${req} → ${tgt} (${type})`;
    }
    if (c.target_group_id) {
      const grp = groups[c.target_group_id];
      return `${req} → группа «${grp?.name ?? '—'}» (${type})`;
    }
    return `${req} (${type})`;
  }

  async function setStatus(id: string, status: 'confirmed' | 'rejected' | 'pending') {
    await run('Обновлено', async () => {
      const patch: Partial<Connection> = { status };
      if (status === 'confirmed') {
        (patch as Connection).confirmed_at = new Date().toISOString();
      }
      const { error } = await supabase.from('connections').update(patch).eq('id', id);
      if (error) throw error;
      await load();
    });
  }

  async function remove(id: string) {
    if (!confirm('Удалить запись связи?')) return;
    await run('Удалено', async () => {
      const { error } = await supabase.from('connections').delete().eq('id', id);
      if (error) throw error;
      await load();
    });
  }

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />
      <Card className="bg-amber-50 border-amber-100 text-sm text-amber-900">
        Здесь можно подтверждать, отклонять и удалять связи от имени организатора. Участники по-прежнему
        работают через экран «Связи» в приложении.
      </Card>
      <div className="flex flex-wrap gap-2 items-center">
        {(['all', 'pending', 'confirmed'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'primary' : 'secondary'}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Все' : f === 'pending' ? 'Ожидают' : 'Подтверждены'}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => load().catch(() => undefined)}>
          Обновить
        </Button>
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Связь</th>
              <th className="text-left p-3">Статус</th>
              <th className="text-left p-3">Дата</th>
              <th className="text-left p-3">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="p-3">{describe(c)}</td>
                <td className="p-3">
                  <span
                    className={
                      c.status === 'confirmed'
                        ? 'text-green-700'
                        : c.status === 'pending'
                          ? 'text-amber-700'
                          : 'text-slate-500'
                    }
                  >
                    {c.status}
                  </span>
                </td>
                <td className="p-3 text-xs text-slate-500">
                  {new Date(c.created_at).toLocaleString('ru-RU')}
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {c.status !== 'confirmed' && (
                      <Button size="sm" onClick={() => setStatus(c.id, 'confirmed')} disabled={saving}>
                        ✓
                      </Button>
                    )}
                    {c.status !== 'rejected' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setStatus(c.id, 'rejected')}
                        disabled={saving}
                      >
                        ✗
                      </Button>
                    )}
                    <Button size="sm" variant="danger" onClick={() => remove(c.id)} disabled={saving}>
                      Del
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-500">
                  Нет записей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        Для process_group цель — группа ({GROUP_TYPE_LABELS.process}).
      </p>
    </div>
  );
}
