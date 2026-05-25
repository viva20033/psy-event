import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminSelectClass, adminTextareaClass } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { supabase } from '@/lib/supabase/client';
import { GROUP_TYPE_LABELS, ROLE_LABELS, type Group, type GroupMember, type GroupType, type Profile } from '@/types';

export function GroupsSection() {
  const { feedback, saving, run } = useAdminFeedback();
  const [groups, setGroups] = useState<Group[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('therapy');
  const [description, setDescription] = useState('');
  const [addProfileId, setAddProfileId] = useState('');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [g, p] = await Promise.all([
      supabase.from('groups').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
    ]);
    if (g.error) throw g.error;
    if (p.error) throw p.error;
    setGroups((g.data ?? []) as Group[]);
    setProfiles((p.data ?? []) as Profile[]);
  }, []);

  const loadMembers = useCallback(async (groupId: string) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('id, group_id, profile_id, is_leader')
      .eq('group_id', groupId);
    if (error) throw error;
    const memberRows = (data ?? []) as GroupMember[];
    const enriched = await Promise.all(
      memberRows.map(async (m) => {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', m.profile_id)
          .single();
        return {
          ...m,
          profile: prof
            ? {
                id: m.profile_id,
                full_name: prof.full_name,
                role: prof.role as Profile['role'],
                access_code: '',
              }
            : undefined,
        };
      }),
    );
    setMembers(enriched);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (selectedId) loadMembers(selectedId).catch(() => undefined);
  }, [selectedId, loadMembers]);

  async function createGroup() {
    if (!name.trim()) return;
    await run('Группа создана', async () => {
      const { error } = await supabase.from('groups').insert({
        name: name.trim(),
        group_type: groupType,
        description: description.trim() || null,
      });
      if (error) throw error;
      setName('');
      setDescription('');
      setCreating(false);
      await load();
    });
  }

  async function addMember() {
    if (!selectedId || !addProfileId) return;
    await run('Добавлен в группу', async () => {
      const { error } = await supabase.from('group_members').insert({
        group_id: selectedId,
        profile_id: addProfileId,
        is_leader: false,
      });
      if (error) throw error;
      setAddProfileId('');
      await loadMembers(selectedId);
    });
  }

  async function removeMember(memberId: string) {
    if (!selectedId) return;
    await run('Убран из группы', async () => {
      const { error } = await supabase.from('group_members').delete().eq('id', memberId);
      if (error) throw error;
      await loadMembers(selectedId);
    });
  }

  async function deleteGroup(id: string) {
    await run('Группа удалена', async () => {
      const { error } = await supabase.from('groups').delete().eq('id', id);
      if (error) throw error;
      setDeleteGroupId(null);
      setSelectedId(null);
      await load();
    });
  }

  const selected = groups.find((g) => g.id === selectedId);

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />
      <Card className="bg-primary-50 border-primary-100 text-sm text-primary-900">
        Группы для расписания и процесс-групп. Состав можно менять — ошиблись, убрали человека, добавили другого.
      </Card>

      <Button fullWidth onClick={() => setCreating(true)}>+ Новая группа</Button>

      {creating && (
        <Card className="space-y-3">
          <FormField label="Название" hint="Например: Группа 12 или Процесс-группа А">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Тип">
            <select className={adminSelectClass} value={groupType} onChange={(e) => setGroupType(e.target.value as GroupType)}>
              {(Object.keys(GROUP_TYPE_LABELS) as GroupType[]).map((t) => (
                <option key={t} value={t}>{GROUP_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Заметка (необязательно)">
            <textarea className={adminTextareaClass} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
          <Button fullWidth onClick={createGroup} disabled={saving}>
            {saving ? '…' : 'Создать'}
          </Button>
          <Button fullWidth variant="secondary" onClick={() => setCreating(false)}>Отмена</Button>
        </Card>
      )}

      <Card className="space-y-2">
        <h3 className="font-semibold">Все группы ({groups.length})</h3>
        {groups.map((g) => (
          <div
            key={g.id}
            className={`rounded-xl border p-3 cursor-pointer ${selectedId === g.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}
            onClick={() => setSelectedId(g.id)}
          >
            <p className="font-medium">{g.name}</p>
            <p className="text-xs text-slate-500">{GROUP_TYPE_LABELS[g.group_type]}</p>
          </div>
        ))}
      </Card>

      {selected && (
        <Card className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">Состав: {selected.name}</h3>
            <Button size="sm" variant="danger" onClick={() => setDeleteGroupId(selected.id)}>
              Удалить группу
            </Button>
          </div>
          <FormField label="Добавить человека в группу">
            <select className={adminSelectClass} value={addProfileId} onChange={(e) => setAddProfileId(e.target.value)}>
              <option value="">— выберите —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} ({ROLE_LABELS[p.role]})</option>
              ))}
            </select>
          </FormField>
          <Button onClick={addMember} disabled={saving || !addProfileId}>Добавить</Button>
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between items-center text-sm border-b py-2">
                <span>{m.profile?.full_name ?? '—'}</span>
                <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}>Убрать</Button>
              </li>
            ))}
            {members.length === 0 && <p className="text-sm text-slate-500">Пока пусто</p>}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteGroupId}
        title="Удалить группу?"
        message="Удалится группа и весь её состав. События с этой группой в расписании проверьте отдельно."
        onConfirm={() => deleteGroupId && deleteGroup(deleteGroupId)}
        onCancel={() => setDeleteGroupId(null)}
        loading={saving}
      />
    </div>
  );
}
