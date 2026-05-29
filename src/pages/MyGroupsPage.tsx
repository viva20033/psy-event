import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/stores/session';
import {
  fetchMyGroups,
  formatGroupMeetingPlace,
  formatTrainerLine,
} from '@/services/groups';
import { GROUP_TYPE_LABELS, type MyGroupView } from '@/types';

export function MyGroupsPage() {
  const profile = useSession((s) => s.profile);
  const [groups, setGroups] = useState<MyGroupView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    fetchMyGroups(profile.id)
      .then(setGroups)
      .catch((e) => setError(e instanceof Error ? e.message : 'Не удалось загрузить'))
      .finally(() => setLoading(false));
  }, [profile]);

  if (!profile) return null;

  return (
    <AppShell title="Мои группы">
      <div className="space-y-4">
        <Card className="bg-primary-50 border-primary-100 text-sm text-primary-900 space-y-2">
          <p>
            <strong>Ваши группы</strong> формируют организаторы. Проверьте состав: нет ли в одной
            группе родственников, близких друзей или коллег. Если есть пересечение — напишите
            организаторам.
          </p>
          <p className="text-primary-800">
            <strong>Процесс-группы</strong> часто выбираются в первый день — после выбора появятся
            здесь и в «Связях».
          </p>
        </Card>

        {loading && <p className="text-center text-slate-500 py-8">Загрузка…</p>}
        {error && (
          <Card className="border-red-200 bg-red-50 text-sm text-red-800">{error}</Card>
        )}

        {!loading && !error && groups.length === 0 && (
          <Card className="text-center text-slate-600 text-sm py-8 space-y-2">
            <p>Вы пока не добавлены ни в одну группу.</p>
            <p className="text-slate-500">
              После регистрации организаторы включат вас в группу — загляните сюда снова.
            </p>
          </Card>
        )}

        {groups.map(({ group, trainers, participants }) => {
          const place = formatGroupMeetingPlace(group);
          return (
            <Card key={group.id} className="space-y-3">
              <div>
                <h2 className="font-semibold text-lg text-primary-900">{group.name}</h2>
                <p className="text-sm text-slate-500">{GROUP_TYPE_LABELS[group.group_type]}</p>
              </div>

              {place ? (
                <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">Где проходит</p>
                  <p className="text-slate-700 mt-0.5">{place}</p>
                  {group.venue?.route_hint && (
                    <p className="text-slate-500 text-xs mt-1">{group.venue.route_hint}</p>
                  )}
                  {group.venue && (
                    <Link to="/territory" className="text-primary-600 text-xs font-medium mt-1 inline-block">
                      Карта территории →
                    </Link>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic">Место уточняет организатор</p>
              )}

              {group.description && (
                <p className="text-sm text-slate-600">{group.description}</p>
              )}

              <div>
                <p className="text-sm font-medium text-slate-800 mb-1">Тренеры</p>
                {trainers.length === 0 ? (
                  <p className="text-sm text-slate-500">Пока не назначены</p>
                ) : (
                  <ul className="text-sm text-slate-700 space-y-1">
                    {trainers.map((t) => (
                      <li key={t.id}>{formatTrainerLine(t)}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-slate-800 mb-1">
                  Участники ({participants.length})
                </p>
                {participants.length === 0 ? (
                  <p className="text-sm text-slate-500">Состав уточняется</p>
                ) : (
                  <ul className="text-sm text-slate-700 flex flex-wrap gap-x-2 gap-y-1">
                    {participants.map((p) => (
                      <li key={p.id}>
                        {p.profile_id === profile.id ? (
                          <span className="font-medium text-primary-800">
                            {p.profile?.full_name ?? '—'} (вы)
                          </span>
                        ) : (
                          p.profile?.full_name ?? '—'
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          );
        })}

        <Link to="/">
          <Button variant="secondary" fullWidth>
            На главную
          </Button>
        </Link>
      </div>
    </AppShell>
  );
}
