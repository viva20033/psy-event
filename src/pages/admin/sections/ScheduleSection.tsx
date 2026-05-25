import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminSelectClass, adminTextareaClass } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { supabase } from '@/lib/supabase/client';
import { isoToLocalInput, localInputToIso } from '@/lib/utils/datetime';
import { ROLE_LABELS, type EventAudience, type EventDay, type Group, type Profile, type ScheduleEvent, type UserRole, type Venue } from '@/types';

type AudienceMode = 'all' | 'role' | 'group';

const emptyEvent = () => ({
  title: '',
  description: '',
  starts_at: '',
  ends_at: '',
  venue_id: '',
  backup_venue_id: '',
  facilitator_id: '',
  audienceMode: 'all' as AudienceMode,
  target_role: 'client' as UserRole,
  group_id: '',
});

export function ScheduleSection() {
  const { feedback, saving, run } = useAdminFeedback();
  const [days, setDays] = useState<EventDay[]>([]);
  const [dayId, setDayId] = useState('');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [form, setForm] = useState(emptyEvent());
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    const [d, v, p, g] = await Promise.all([
      supabase.from('event_days').select('*').order('day_index'),
      supabase.from('venues').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
      supabase.from('groups').select('*').order('name'),
    ]);
    if (d.error) throw d.error;
    if (v.error) throw v.error;
    if (p.error) throw p.error;
    if (g.error) throw g.error;
    const dayList = (d.data ?? []) as EventDay[];
    setDays(dayList);
    setVenues((v.data ?? []) as Venue[]);
    setProfiles((p.data ?? []) as Profile[]);
    setGroups((g.data ?? []) as Group[]);
    setDayId((prev) => prev || dayList[0]?.id || '');
  }, []);

  const loadEvents = useCallback(async () => {
    if (!dayId) return;
    const { data, error } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('event_day_id', dayId)
      .order('starts_at');
    if (error) throw error;
    setEvents((data ?? []) as ScheduleEvent[]);
  }, [dayId]);

  useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta]);

  useEffect(() => {
    loadEvents().catch(() => undefined);
  }, [loadEvents]);

  async function openEdit(ev: ScheduleEvent) {
    const { data: aud } = await supabase
      .from('event_audience')
      .select('*')
      .eq('event_id', ev.id);
    const rows = (aud ?? []) as EventAudience[];
    let audienceMode: AudienceMode = 'all';
    let target_role: UserRole = 'client';
    let group_id = '';
    if (rows.some((r) => r.for_everyone)) audienceMode = 'all';
    else if (rows[0]?.target_role) {
      audienceMode = 'role';
      target_role = rows[0].target_role;
    } else if (rows[0]?.group_id) {
      audienceMode = 'group';
      group_id = rows[0].group_id;
    }
    setForm({
      title: ev.title,
      description: ev.description ?? '',
      starts_at: isoToLocalInput(ev.starts_at),
      ends_at: isoToLocalInput(ev.ends_at),
      venue_id: ev.venue_id ?? '',
      backup_venue_id: ev.backup_venue_id ?? '',
      facilitator_id: ev.facilitator_id ?? '',
      audienceMode,
      target_role,
      group_id,
    });
    setEditId(ev.id);
    setShowForm(true);
  }

  async function saveAudience(eventId: string) {
    await supabase.from('event_audience').delete().eq('event_id', eventId);
    if (form.audienceMode === 'all') {
      await supabase.from('event_audience').insert({
        event_id: eventId,
        for_everyone: true,
      });
    } else if (form.audienceMode === 'role') {
      await supabase.from('event_audience').insert({
        event_id: eventId,
        target_role: form.target_role,
        for_everyone: false,
      });
    } else if (form.group_id) {
      await supabase.from('event_audience').insert({
        event_id: eventId,
        group_id: form.group_id,
        for_everyone: false,
      });
    }
  }

  async function save() {
    if (!dayId || !form.title.trim() || !form.starts_at || !form.ends_at) return;
    const wasEdit = Boolean(editId);
    await run(wasEdit ? 'Событие обновлено' : 'Событие добавлено', async () => {
      const row = {
        event_day_id: dayId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        starts_at: localInputToIso(form.starts_at),
        ends_at: localInputToIso(form.ends_at),
        venue_id: form.venue_id || null,
        backup_venue_id: form.backup_venue_id || null,
        facilitator_id: form.facilitator_id || null,
      };
      let eventId = editId;
      if (editId) {
        const { error } = await supabase.from('schedule_events').update(row).eq('id', editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('schedule_events').insert(row).select('id').single();
        if (error) throw error;
        eventId = data.id;
      }
      if (eventId) await saveAudience(eventId);
      setShowForm(false);
      setEditId(null);
      setForm(emptyEvent());
      await loadEvents();
    });
  }

  async function remove(id: string) {
    await run('Событие удалено', async () => {
      const { error } = await supabase.from('schedule_events').delete().eq('id', id);
      if (error) throw error;
      setDeleteId(null);
      await loadEvents();
    });
  }

  const venueName = (id: string | null) => venues.find((v) => v.id === id)?.name ?? '—';

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />
      <Card className="bg-primary-50 border-primary-100 text-sm text-primary-900">
        <strong>Расписание.</strong> Выберите день → добавьте события. Укажите основное и запасное место (на дождь).
        «Кому показать» — всем, одной роли или одной группе.
      </Card>

      <FormField label="День интенсива">
        <select className={adminSelectClass} value={dayId} onChange={(e) => setDayId(e.target.value)}>
          {days.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </FormField>

      <Button
        fullWidth
        onClick={() => {
          setForm(emptyEvent());
          setEditId(null);
          setShowForm(true);
        }}
      >
        + Событие в этот день
      </Button>

      {showForm && (
        <Card className="space-y-3 border-2 border-primary-200">
          <h3 className="font-semibold">{editId ? 'Изменить событие' : 'Новое событие'}</h3>
          <FormField label="Название">
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </FormField>
          <FormField label="Начало">
            <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
          </FormField>
          <FormField label="Конец">
            <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
          </FormField>
          <FormField label="Место">
            <select className={adminSelectClass} value={form.venue_id} onChange={(e) => setForm((f) => ({ ...f, venue_id: e.target.value }))}>
              <option value="">— не указано —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Запасное место (дождь)">
            <select className={adminSelectClass} value={form.backup_venue_id} onChange={(e) => setForm((f) => ({ ...f, backup_venue_id: e.target.value }))}>
              <option value="">— нет —</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Ведущий (необязательно)">
            <select className={adminSelectClass} value={form.facilitator_id} onChange={(e) => setForm((f) => ({ ...f, facilitator_id: e.target.value }))}>
              <option value="">— нет —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name} ({ROLE_LABELS[p.role]})</option>
              ))}
            </select>
          </FormField>
          <FormField label="Описание (необязательно)">
            <textarea className={adminTextareaClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </FormField>
          <FormField label="Кому показать в расписании">
            <select className={adminSelectClass} value={form.audienceMode} onChange={(e) => setForm((f) => ({ ...f, audienceMode: e.target.value as AudienceMode }))}>
              <option value="all">Всем участникам</option>
              <option value="role">Только одной роли</option>
              <option value="group">Только одной группе</option>
            </select>
          </FormField>
          {form.audienceMode === 'role' && (
            <FormField label="Роль">
              <select className={adminSelectClass} value={form.target_role} onChange={(e) => setForm((f) => ({ ...f, target_role: e.target.value as UserRole }))}>
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </FormField>
          )}
          {form.audienceMode === 'group' && (
            <FormField label="Группа">
              <select className={adminSelectClass} value={form.group_id} onChange={(e) => setForm((f) => ({ ...f, group_id: e.target.value }))}>
                <option value="">— выберите —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </FormField>
          )}
          <Button fullWidth onClick={save} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
          <Button fullWidth variant="secondary" onClick={() => setShowForm(false)}>Отмена</Button>
        </Card>
      )}

      <Card className="space-y-2">
        <h3 className="font-semibold">События ({events.length})</h3>
        {events.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">Пока нет — нажмите «+ Событие»</p>
        ) : (
          events.map((ev) => (
            <div key={ev.id} className="border-b border-slate-100 py-3 last:border-0 space-y-1">
              <p className="font-medium">{ev.title}</p>
              <p className="text-xs text-slate-500">
                {new Date(ev.starts_at).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {new Date(ev.ends_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-xs">Место: {venueName(ev.venue_id)}</p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={() => openEdit(ev)}>Изменить</Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteId(ev.id)}>Удалить</Button>
              </div>
            </div>
          ))
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        title="Удалить событие?"
        message="Его не будет в расписании участников. Это действие нельзя отменить."
        onConfirm={() => deleteId && remove(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={saving}
      />
    </div>
  );
}
