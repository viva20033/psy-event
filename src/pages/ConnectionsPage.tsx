import { useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useOfflineData } from '@/hooks/useOfflineData';
import { useSession } from '@/stores/session';
import { requestConnection, respondConnection } from '@/services/connections';
import { pullConnections } from '@/lib/offline/sync';
import { supabase } from '@/lib/supabase/client';
import type { ConnectionType, Profile, UserRole } from '@/types';
import { CONNECTION_TYPE_LABELS } from '@/types';

const SELECTABLE_ROLES: Record<UserRole, UserRole[]> = {
  client: ['therapist'],
  therapist: ['supervisor'],
  supervisor: [],
  hypervisor: [],
  organizer: [],
  admin: [],
};

const CONNECTION_MAP: Record<string, ConnectionType> = {
  therapist: 'client_therapist',
  supervisor: 'therapist_supervisor',
};

export function ConnectionsPage() {
  const profile = useSession((s) => s.profile);
  const { connections } = useOfflineData();
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickRole, setPickRole] = useState<UserRole | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');

  const incoming = useMemo(() => {
    if (!profile) return [];
    return connections.filter(
      (c) => c.target_profile_id === profile.id && c.status === 'pending',
    );
  }, [connections, profile]);

  const confirmed = useMemo(() => {
    if (!profile) return [];
    return connections.filter((c) => c.status === 'confirmed');
  }, [connections, profile]);

  async function loadPeople(role: UserRole) {
    setPickRole(role);
    setSelected(null);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, access_code')
        .eq('role', role)
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      setPeople((data ?? []) as Profile[]);
    } catch {
      setMessage('Не удалось загрузить список. Проверьте сеть.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmChoice() {
    if (!selected || !pickRole || !profile) return;
    setLoading(true);
    setMessage('');
    try {
      await requestConnection(CONNECTION_MAP[pickRole], selected.id);
      setMessage(`Запрос отправлен: ${selected.full_name}. Ожидает подтверждения.`);
      setSelected(null);
      setPickRole(null);
      await pullConnections();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Ошибка отправки запроса');
    } finally {
      setLoading(false);
    }
  }

  async function handleRespond(id: string, accept: boolean) {
    setLoading(true);
    try {
      await respondConnection(id, accept);
      await pullConnections();
    } finally {
      setLoading(false);
    }
  }

  if (!profile) return null;

  const canPick = SELECTABLE_ROLES[profile.role] ?? [];

  return (
    <AppShell title="Мои связи">
      <div className="space-y-4">
        {canPick.length > 0 && (
          <Card className="space-y-3">
            <h3 className="font-semibold">Подтвердить выбор</h3>
            <p className="text-sm text-slate-600">
              Выберите человека после живого контакта на площадке. Приложение только фиксирует выбор.
            </p>
            <div className="flex flex-wrap gap-2">
              {canPick.map((role) => (
                <Button
                  key={role}
                  size="sm"
                  variant={pickRole === role ? 'primary' : 'secondary'}
                  onClick={() => loadPeople(role)}
                >
                  {CONNECTION_TYPE_LABELS[CONNECTION_MAP[role]]}
                </Button>
              ))}
            </div>
            {pickRole && (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {people.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(p)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        selected?.id === p.id
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-slate-200'
                      }`}
                    >
                      {p.full_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selected && (
              <div className="space-y-2">
                <p className="font-medium">{selected.full_name}</p>
                <Button fullWidth onClick={confirmChoice} disabled={loading}>
                  Подтвердить выбор
                </Button>
              </div>
            )}
          </Card>
        )}

        {incoming.length > 0 && (
          <Card className="space-y-3">
            <h3 className="font-semibold">Входящие запросы</h3>
            {incoming.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-200 p-3">
                <p className="text-sm">
                  {c.requester?.full_name ?? 'Участник'} хочет выбрать вас
                </p>
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
          <h3 className="font-semibold">Мои связи</h3>
          {confirmed.length === 0 ? (
            <p className="text-sm text-slate-500">Подтверждённых связей пока нет</p>
          ) : (
            confirmed.map((c) => (
              <p key={c.id} className="text-sm">
                {CONNECTION_TYPE_LABELS[c.connection_type]}:{' '}
                {c.requester?.full_name ?? c.target_profile?.full_name ?? '—'}
              </p>
            ))
          )}
        </Card>

        {message && <p className="text-sm text-primary-700">{message}</p>}
      </div>
    </AppShell>
  );
}
