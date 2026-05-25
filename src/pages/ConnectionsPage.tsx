import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useSession } from '@/stores/session';
import { requestConnection, respondConnection } from '@/services/connections';
import { pullConnections } from '@/lib/offline/sync';
import { supabase } from '@/lib/supabase/client';
import type { Connection, ConnectionType, Group, Profile, UserRole } from '@/types';
import { CONNECTION_TYPE_LABELS } from '@/types';

const CONNECTION_MAP: Record<string, ConnectionType> = {
  therapist: 'client_therapist',
  supervisor: 'therapist_supervisor',
};

export function ConnectionsPage() {
  const profile = useSession((s) => s.profile);
  const { connections } = useOfflineData();
  const [people, setPeople] = useState<Profile[]>([]);
  const [processGroups, setProcessGroups] = useState<Group[]>([]);
  const [leaderGroupIds, setLeaderGroupIds] = useState<Set<string>>(new Set());
  const [nameById, setNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'therapist' | 'supervisor' | 'process_group' | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Profile | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [message, setMessage] = useState('');

  const loadNames = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    const map: Record<string, string> = {};
    for (const p of data ?? []) map[p.id] = p.full_name;
    setNameById(map);
  }, []);

  const loadLeaderGroups = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('profile_id', profile.id)
      .eq('is_leader', true);
    setLeaderGroupIds(new Set((data ?? []).map((r) => r.group_id)));
  }, [profile]);

  useEffect(() => {
    loadNames().catch(() => undefined);
    loadLeaderGroups().catch(() => undefined);
    pullConnections().catch(() => undefined);
  }, [loadNames, loadLeaderGroups]);

  const incoming = useMemo(() => {
    if (!profile) return [];
    return connections.filter((c) => {
      if (c.status !== 'pending') return false;
      if (c.target_profile_id === profile.id) return true;
      if (c.target_group_id && leaderGroupIds.has(c.target_group_id)) return true;
      return false;
    });
  }, [connections, profile, leaderGroupIds]);

  const confirmed = useMemo(() => {
    if (!profile) return [];
    return connections.filter((c) => c.status === 'confirmed');
  }, [connections, profile]);

  function labelForConnection(c: Connection): string {
    const type = CONNECTION_TYPE_LABELS[c.connection_type];
    if (c.connection_type === 'process_group' && c.target_group_id) {
      return `${type}: группа (подтверждено)`;
    }
    const otherId =
      c.requester_id === profile?.id ? c.target_profile_id : c.requester_id;
    const name = otherId ? nameById[otherId] : null;
    return `${type}: ${name ?? '—'}`;
  }

  function labelIncoming(c: Connection): string {
    const name = nameById[c.requester_id] ?? 'Участник';
    if (c.connection_type === 'process_group') {
      return `${name} выбирает вашу процесс-группу`;
    }
    return `${name} хочет выбрать вас`;
  }

  async function loadTherapistsOrSupervisors(role: UserRole) {
    setMode(role === 'therapist' ? 'therapist' : 'supervisor');
    setSelectedPerson(null);
    setSelectedGroup(null);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', role)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      setPeople((data ?? []) as Profile[]);
    } catch {
      setMessage('Не удалось загрузить список. Нужен интернет.');
    } finally {
      setLoading(false);
    }
  }

  async function loadProcessGroups() {
    setMode('process_group');
    setSelectedPerson(null);
    setSelectedGroup(null);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('group_type', 'process')
        .order('name');
      if (error) throw error;
      setProcessGroups((data ?? []) as Group[]);
      if (!(data ?? []).length) {
        setMessage('Процесс-групп пока нет — создайте в админке → Группы.');
      }
    } catch {
      setMessage('Не удалось загрузить группы.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmPersonChoice() {
    if (!selectedPerson || !mode || mode === 'process_group') return;
    const type = CONNECTION_MAP[mode === 'therapist' ? 'therapist' : 'supervisor'];
    setLoading(true);
    setMessage('');
    try {
      await requestConnection(type, selectedPerson.id);
      setMessage(
        `Запрос отправлен: ${selectedPerson.full_name}. Попросите его/её открыть «Мои связи» и нажать «Подтвердить».`,
      );
      setSelectedPerson(null);
      setMode(null);
      await pullConnections();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function confirmProcessGroup() {
    if (!selectedGroup) return;
    setLoading(true);
    try {
      await requestConnection('process_group', undefined, selectedGroup.id);
      setMessage(
        `Запрос в группу «${selectedGroup.name}». Ведущий группы подтвердит в «Мои связи».`,
      );
      setSelectedGroup(null);
      setMode(null);
      await pullConnections();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function handleRespond(id: string, accept: boolean) {
    setLoading(true);
    try {
      await respondConnection(id, accept);
      await pullConnections();
      setMessage(accept ? 'Связь подтверждена' : 'Запрос отклонён');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  if (!profile) return null;

  const isClient = profile.role === 'client';
  const isTherapist = profile.role === 'therapist';

  return (
    <AppShell title="Мои связи">
      <div className="space-y-4">
        <Card className="bg-primary-50 border-primary-100 text-sm text-primary-900 space-y-2">
          <p>
            <strong>Связи не назначает организатор.</strong> Их фиксируют сами участники после
            живого выбора на площадке — в два шага.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-primary-800">
            <li>Клиент выбирает терапевта → терапевт подтверждает</li>
            <li>Терапевт выбирает супервизора → супервизор подтверждает</li>
            <li>Клиент выбирает процесс-группу → ведущий группы подтверждает</li>
          </ol>
        </Card>

        {isClient && (
          <Card className="space-y-3">
            <h3 className="font-semibold">Я — клиент</h3>
            <p className="text-sm text-slate-600">После выбора терапевта в кругу:</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={mode === 'therapist' ? 'primary' : 'secondary'}
                onClick={() => loadTherapistsOrSupervisors('therapist')}
              >
                Выбрать терапевта
              </Button>
              <Button
                size="sm"
                variant={mode === 'process_group' ? 'primary' : 'secondary'}
                onClick={loadProcessGroups}
              >
                Выбрать процесс-группу
              </Button>
            </div>
          </Card>
        )}

        {isTherapist && (
          <Card className="space-y-3">
            <h3 className="font-semibold">Я — терапевт</h3>
            <p className="text-sm text-slate-600">После выбора супервизора:</p>
            <Button
              size="sm"
              variant={mode === 'supervisor' ? 'primary' : 'secondary'}
              onClick={() => loadTherapistsOrSupervisors('supervisor')}
            >
              Выбрать супервизора
            </Button>
          </Card>
        )}

        {mode === 'therapist' || mode === 'supervisor' ? (
          <Card className="space-y-2">
            <p className="text-sm font-medium">
              Кого выбрали?
            </p>
            <ul className="space-y-2 max-h-52 overflow-y-auto">
              {people.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedPerson(p)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedPerson?.id === p.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-slate-200'
                    }`}
                  >
                    {p.full_name}
                  </button>
                </li>
              ))}
            </ul>
            {selectedPerson && (
              <Button fullWidth onClick={confirmPersonChoice} disabled={loading}>
                Подтвердить: {selectedPerson.full_name}
              </Button>
            )}
          </Card>
        ) : null}

        {mode === 'process_group' ? (
          <Card className="space-y-2">
            <p className="text-sm font-medium">Какую процесс-группу?</p>
            <ul className="space-y-2 max-h-52 overflow-y-auto">
              {processGroups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(g)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      selectedGroup?.id === g.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-slate-200'
                    }`}
                  >
                    {g.name}
                  </button>
                </li>
              ))}
            </ul>
            {selectedGroup && (
              <Button fullWidth onClick={confirmProcessGroup} disabled={loading}>
                Подтвердить: {selectedGroup.name}
              </Button>
            )}
          </Card>
        ) : null}

        {incoming.length > 0 && (
          <Card className="space-y-3 border-amber-200 bg-amber-50">
            <h3 className="font-semibold">К вам — нужно подтвердить</h3>
            {incoming.map((c) => (
              <div key={c.id} className="rounded-lg border border-amber-200 bg-white p-3">
                <p className="text-sm">{labelIncoming(c)}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => handleRespond(c.id, true)} disabled={loading}>
                    Подтвердить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleRespond(c.id, false)} disabled={loading}>
                    Отклонить
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}

        <Card className="space-y-2">
          <h3 className="font-semibold">Подтверждённые связи</h3>
          {confirmed.length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет — это нормально до выбора на интенсиве</p>
          ) : (
            confirmed.map((c) => (
              <p key={c.id} className="text-sm text-slate-700">
                {labelForConnection(c)}
              </p>
            ))
          )}
        </Card>

        {message && (
          <Card className="bg-slate-100 text-sm text-slate-800">{message}</Card>
        )}
      </div>
    </AppShell>
  );
}
