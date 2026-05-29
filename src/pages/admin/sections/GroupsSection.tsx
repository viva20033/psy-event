import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminSelectClass, adminTextareaClass } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { supabase } from '@/lib/supabase/client';
import {
  GROUP_MEMBER_ROLE_LABELS,
  GROUP_TYPE_LABELS,
  ROLE_LABELS,
  type Group,
  type GroupMember,
  type GroupMemberRole,
  type GroupType,
  type Profile,
  type Venue,
} from '@/types';

export function GroupsSection() {
  const { feedback, saving, run } = useAdminFeedback();
  const [groups, setGroups] = useState<Group[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [groupType, setGroupType] = useState<GroupType>('therapy');
  const [description, setDescription] = useState('');
  const [editVenueId, setEditVenueId] = useState('');
  const [editMeetingNote, setEditMeetingNote] = useState('');
  const [addProfileId, setAddProfileId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<GroupMemberRole>('participant');
  const [addThreeDayBlock, setAddThreeDayBlock] = useState('1');
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const [g, p, v] = await Promise.all([
      supabase.from('groups').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
      supabase.from('venues').select('id, name').eq('is_active', true).order('sort_order'),
    ]);
    if (g.error) throw g.error;
    if (p.error) throw p.error;
    if (v.error) throw v.error;
    setGroups((g.data ?? []) as Group[]);
    setProfiles((p.data ?? []) as Profile[]);
    setVenues((v.data ?? []) as Venue[]);
  }, []);

  const loadMembers = useCallback(async (groupId: string) => {
    const { data, error } = await supabase
      .from('group_members')
      .select(
        'id, group_id, profile_id, is_leader, member_role, three_day_block, profile:profiles(id, full_name, role)',
      )
      .eq('group_id', groupId);
    if (error) throw error;
    const rows = (data ?? []).map((row) => {
      const r = row as GroupMember & {
        profile?: GroupMember['profile'] | GroupMember['profile'][] | null;
      };
      const profile = Array.isArray(r.profile) ? r.profile[0] : r.profile;
      return { ...r, profile } as GroupMember;
    });
    setMembers(rows);
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (selectedId) {
      const g = groups.find((x) => x.id === selectedId);
      setEditVenueId(g?.venue_id ?? '');
      setEditMeetingNote(g?.meeting_note ?? '');
      loadMembers(selectedId).catch(() => undefined);
    }
  }, [selectedId, groups, loadMembers]);

  async function createGroup() {
    if (!name.trim()) return;
    await run('Группа создана', async () => {
      const { error } = await supabase.from('groups').insert({
        name: name.trim(),
        group_type: groupType,
        description: description.trim() || null,
        venue_id: editVenueId || null,
        meeting_note: editMeetingNote.trim() || null,
      });
      if (error) throw error;
      setName('');
      setDescription('');
      setEditVenueId('');
      setEditMeetingNote('');
      setCreating(false);
      await load();
    });
  }

  async function saveGroupDetails() {
    if (!selectedId) return;
    await run('Сохранено', async () => {
      const { error } = await supabase
        .from('groups')
        .update({
          venue_id: editVenueId || null,
          meeting_note: editMeetingNote.trim() || null,
        })
        .eq('id', selectedId);
      if (error) throw error;
      await load();
    });
  }

  async function addMember() {
    if (!selectedId || !addProfileId) return;
    const isLeader = addMemberRole === 'leader';
    const block =
      addMemberRole === 'invited_trainer' ? Number(addThreeDayBlock) : null;
    await run('Добавлен в группу', async () => {
      const { error } = await supabase.from('group_members').insert({
        group_id: selectedId,
        profile_id: addProfileId,
        member_role: addMemberRole,
        three_day_block: block,
        is_leader: isLeader,
      });
      if (error) throw error;
      setAddProfileId('');
      setAddMemberRole('participant');
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

  function memberRoleLabel(m: GroupMember): string {
    const role = m.member_role ?? (m.is_leader ? 'leader' : 'participant');
    let label = GROUP_MEMBER_ROLE_LABELS[role as GroupMemberRole] ?? role;
    if (role === 'invited_trainer' && m.three_day_block) {
      label += ` (${m.three_day_block}-я трёхдневка)`;
    }
    return label;
  }

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />
      <Card className="bg-primary-50 border-primary-100 text-sm text-primary-900 space-y-2">
        <p>
          <strong>Терапевтические / супервизионные</strong> — состав задают организаторы до интенсива.
          Укажите место и тренеров: линейный (все 3 трёхдневки), приглашённый (одна трёхдневка).
        </p>
        <p>
          <strong>Процесс-группы</strong> — часто формируются в 1-й день; ведущий = тренер или супервизор
          (роль «Ведущий»).
        </p>
        <p>Участники видят группу в приложении: «Мои группы».</p>
      </Card>

      <Button fullWidth onClick={() => setCreating(true)}>+ Новая группа</Button>

      {creating && (
        <Card className="space-y-3">
          <FormField label="Название" hint="Например: Группа 12">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Тип">
            <select
              className={adminSelectClass}
              value={groupType}
              onChange={(e) => setGroupType(e.target.value as GroupType)}
            >
              {(Object.keys(GROUP_TYPE_LABELS) as GroupType[]).map((t) => (
                <option key={t} value={t}>{GROUP_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Место (из справочника)">
            <select
              className={adminSelectClass}
              value={editVenueId}
              onChange={(e) => setEditVenueId(e.target.value)}
            >
              <option value="">— не выбрано —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Или текст «где встречаемся»">
            <Input
              value={editMeetingNote}
              onChange={(e) => setEditMeetingNote(e.target.value)}
              placeholder="Например: беседка у входа"
            />
          </FormField>
          <FormField label="Заметка (необязательно)">
            <textarea
              className={adminTextareaClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <Button fullWidth onClick={createGroup} disabled={saving}>
            {saving ? '…' : 'Создать'}
          </Button>
          <Button fullWidth variant="secondary" onClick={() => setCreating(false)}>
            Отмена
          </Button>
        </Card>
      )}

      <Card className="space-y-2">
        <h3 className="font-semibold">Все группы ({groups.length})</h3>
        {groups.map((g) => (
          <div
            key={g.id}
            role="button"
            tabIndex={0}
            className={`rounded-xl border p-3 cursor-pointer ${selectedId === g.id ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}
            onClick={() => setSelectedId(g.id)}
            onKeyDown={(e) => e.key === 'Enter' && setSelectedId(g.id)}
          >
            <p className="font-medium">{g.name}</p>
            <p className="text-xs text-slate-500">{GROUP_TYPE_LABELS[g.group_type]}</p>
          </div>
        ))}
      </Card>

      {selected && (
        <Card className="space-y-3">
          <div className="flex justify-between items-center gap-2">
            <h3 className="font-semibold">Состав: {selected.name}</h3>
            <Button size="sm" variant="danger" onClick={() => setDeleteGroupId(selected.id)}>
              Удалить
            </Button>
          </div>

          <FormField label="Место на территории">
            <select
              className={adminSelectClass}
              value={editVenueId}
              onChange={(e) => setEditVenueId(e.target.value)}
            >
              <option value="">— не выбрано —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Уточнение, где встречается">
            <Input
              value={editMeetingNote}
              onChange={(e) => setEditMeetingNote(e.target.value)}
            />
          </FormField>
          <Button size="sm" onClick={saveGroupDetails} disabled={saving}>
            Сохранить место
          </Button>

          <hr className="border-slate-100" />

          <FormField label="Добавить человека">
            <select
              className={adminSelectClass}
              value={addProfileId}
              onChange={(e) => setAddProfileId(e.target.value)}
            >
              <option value="">— выберите —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({ROLE_LABELS[p.role]})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Роль в группе">
            <select
              className={adminSelectClass}
              value={addMemberRole}
              onChange={(e) => setAddMemberRole(e.target.value as GroupMemberRole)}
            >
              {(Object.keys(GROUP_MEMBER_ROLE_LABELS) as GroupMemberRole[]).map((r) => (
                <option key={r} value={r}>{GROUP_MEMBER_ROLE_LABELS[r]}</option>
              ))}
            </select>
          </FormField>
          {addMemberRole === 'invited_trainer' && (
            <FormField label="Какая трёхдневка">
              <select
                className={adminSelectClass}
                value={addThreeDayBlock}
                onChange={(e) => setAddThreeDayBlock(e.target.value)}
              >
                <option value="1">1-я</option>
                <option value="2">2-я</option>
                <option value="3">3-я</option>
              </select>
            </FormField>
          )}
          <Button onClick={addMember} disabled={saving || !addProfileId}>
            Добавить
          </Button>

          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between items-start gap-2 text-sm border-b py-2">
                <div>
                  <p className="font-medium">{m.profile?.full_name ?? '—'}</p>
                  <p className="text-xs text-slate-500">{memberRoleLabel(m)}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}>
                  Убрать
                </Button>
              </li>
            ))}
            {members.length === 0 && <p className="text-sm text-slate-500">Пока пусто</p>}
          </ul>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteGroupId}
        title="Удалить группу?"
        message="Удалится группа и весь состав."
        onConfirm={() => deleteGroupId && deleteGroup(deleteGroupId)}
        onCancel={() => setDeleteGroupId(null)}
        loading={saving}
      />
    </div>
  );
}
