import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminTextareaClass } from '@/components/admin/FormField';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { supabase } from '@/lib/supabase/client';
import { parseCsv, downloadTextFile } from '@/lib/office/csv';
import {
  GROUP_MEMBER_ROLE_LABELS,
  GROUP_TYPE_LABELS,
  type Group,
  type GroupMember,
  type GroupMemberRole,
  type Profile,
} from '@/types';

type Row = GroupMember & {
  profile?: Profile | null;
  group?: Group | null;
};

export function OfficeGroupsMatrix() {
  const { feedback, saving, run, setFeedback } = useAdminFeedback();
  const [rows, setRows] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [csv, setCsv] = useState(
    'group_name;full_name;member_role\nТерапия 1;Иванов Иван;participant',
  );

  const load = useCallback(async () => {
    const [m, g, p] = await Promise.all([
      supabase
        .from('group_members')
        .select(
          'id, group_id, profile_id, is_leader, member_role, three_day_block, profile:profiles(id, full_name, role), group:groups(id, name, group_type)',
        ),
      supabase.from('groups').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, role, access_code').eq('is_active', true),
    ]);
    if (m.error) throw m.error;
    if (g.error) throw g.error;
    if (p.error) throw p.error;
    const normalized = (m.data ?? []).map((row) => {
      const r = row as Row & {
        profile?: Profile | Profile[] | null;
        group?: Group | Group[] | null;
      };
      return {
        ...r,
        profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
        group: Array.isArray(r.group) ? r.group[0] : r.group,
      } as Row;
    });
    setRows(normalized);
    setGroups((g.data ?? []) as Group[]);
    setProfiles((p.data ?? []) as Profile[]);
  }, []);

  useEffect(() => {
    load().catch((e) =>
      setFeedback({ type: 'err', text: e instanceof Error ? e.message : 'Ошибка' }),
    );
  }, [load, setFeedback]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.profile?.full_name.toLowerCase().includes(q) ||
        r.group?.name.toLowerCase().includes(q),
    );
  }, [rows, search]);

  function roleLabel(r: Row): string {
    const role = r.member_role ?? (r.is_leader ? 'leader' : 'participant');
    let label = GROUP_MEMBER_ROLE_LABELS[role as GroupMemberRole] ?? role;
    if (role === 'invited_trainer' && r.three_day_block) {
      label += ` (${r.three_day_block})`;
    }
    return label;
  }

  function exportMatrix() {
    const header = 'group_name;group_type;full_name;member_role;three_day_block';
    const lines = rows.map(
      (r) =>
        `${r.group?.name ?? ''};${r.group?.group_type ?? ''};${r.profile?.full_name ?? ''};${r.member_role ?? 'participant'};${r.three_day_block ?? ''}`,
    );
    downloadTextFile('groups-matrix.csv', [header, ...lines].join('\n'));
    setFeedback({ type: 'ok', text: 'Экспорт скачан' });
  }

  async function importMatrix() {
    const parsed = parseCsv(csv);
    if (parsed.length < 2) {
      setFeedback({ type: 'err', text: 'Нужны заголовок и данные' });
      return;
    }
    const h = parsed[0].map((x) => x.toLowerCase());
    const gi = h.indexOf('group_name');
    const ni = h.findIndex((x) => x === 'full_name' || x === 'name');
    const ri = h.indexOf('member_role');
    const bi = h.indexOf('three_day_block');
    if (gi < 0 || ni < 0) {
      setFeedback({ type: 'err', text: 'Нужны колонки group_name и full_name' });
      return;
    }

    let ok = 0;
    const errs: string[] = [];

    await run('Импорт в группы', async () => {
      for (let i = 1; i < parsed.length; i++) {
        const line = parsed[i];
        const groupName = line[gi]?.trim();
        const personName = line[ni]?.trim();
        if (!groupName || !personName) continue;
        const group = groups.find(
          (g) => g.name.toLowerCase() === groupName.toLowerCase(),
        );
        const profile = profiles.find(
          (p) => p.full_name.toLowerCase() === personName.toLowerCase(),
        );
        if (!group) {
          errs.push(`Группа не найдена: ${groupName}`);
          continue;
        }
        if (!profile) {
          errs.push(`Участник не найден: ${personName}`);
          continue;
        }
        let member_role: GroupMemberRole = 'participant';
        if (ri >= 0 && line[ri]) {
          const r = line[ri].trim() as GroupMemberRole;
          if (r in GROUP_MEMBER_ROLE_LABELS) member_role = r;
        }
        const block =
          bi >= 0 && line[bi] ? Number(line[bi]) || null : null;
        const { error } = await supabase.from('group_members').upsert(
          {
            group_id: group.id,
            profile_id: profile.id,
            member_role,
            three_day_block: member_role === 'invited_trainer' ? block : null,
            is_leader: member_role === 'leader',
          },
          { onConflict: 'group_id,profile_id' },
        );
        if (error) {
          errs.push(`${personName}: ${error.message}`);
        } else {
          ok++;
        }
      }
      await load();
      if (errs.length) {
        setFeedback({
          type: 'err',
          text: `Добавлено/обновлено: ${ok}. Ошибки: ${errs.slice(0, 5).join('; ')}`,
        });
      }
    });
  }

  async function removeMember(id: string) {
    await run('Убран из группы', async () => {
      const { error } = await supabase.from('group_members').delete().eq('id', id);
      if (error) throw error;
      await load();
    });
  }

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />
      <Card className="space-y-3">
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <h2 className="text-lg font-semibold">Состав групп ({rows.length})</h2>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={exportMatrix}>
              Экспорт CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => load().catch(() => undefined)}>
              Обновить
            </Button>
          </div>
        </div>
        <Input
          placeholder="Поиск по имени или группе…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left p-3">Группа</th>
              <th className="text-left p-3">Тип</th>
              <th className="text-left p-3">Участник</th>
              <th className="text-left p-3">Роль в группе</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="p-3 font-medium">{r.group?.name ?? '—'}</td>
                <td className="p-3 text-slate-500">
                  {r.group ? GROUP_TYPE_LABELS[r.group.group_type] : '—'}
                </td>
                <td className="p-3">{r.profile?.full_name ?? '—'}</td>
                <td className="p-3">{roleLabel(r)}</td>
                <td className="p-3">
                  <Button size="sm" variant="ghost" onClick={() => removeMember(r.id)}>
                    Убрать
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  Пусто
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card className="space-y-3 max-w-3xl">
        <h3 className="font-semibold">Импорт состава из CSV</h3>
        <p className="text-sm text-slate-600">
          Колонки: group_name, full_name, member_role (participant | linear_trainer |
          invited_trainer | leader), three_day_block (1–3 для invited_trainer). Группа и человек
          должны уже существовать.
        </p>
        <FormField label="CSV">
          <textarea
            className={adminTextareaClass + ' font-mono text-sm min-h-[120px]'}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </FormField>
        <Button onClick={() => void importMatrix()} disabled={saving}>
          {saving ? '…' : 'Импортировать в группы'}
        </Button>
      </Card>
    </div>
  );
}
