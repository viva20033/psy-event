import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminSelectClass, adminTextareaClass } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { useAdminData } from '@/stores/adminData';
import { supabase } from '@/lib/supabase/client';
import { importFromGestaltUrl } from '@/services/trainers';
import { uploadImage } from '@/lib/supabase/uploadImage';
import { ROLE_LABELS, type IntensiveTrainer, type Profile } from '@/types';

const emptyForm = () => ({
  id: undefined as string | undefined,
  profile_id: '',
  gestalt_url: '',
  full_name: '',
  photo_url: '',
  status_line: '',
  bio: '',
  specializations: '',
  phone: '',
  email: '',
  city: '',
  sort_order: 0,
  is_visible: true,
});

export function TrainersSection() {
  const { feedback, saving, run, setFeedback } = useAdminFeedback();
  const profiles = useAdminData((s) => s.profiles);
  const ensureProfiles = useAdminData((s) => s.ensureProfiles);
  const [list, setList] = useState<IntensiveTrainer[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('intensive_trainers')
      .select('*')
      .order('sort_order')
      .order('full_name');
    if (error) throw error;
    setList((data ?? []) as IntensiveTrainer[]);
  }, []);

  useEffect(() => {
    void ensureProfiles();
    load().catch(() => undefined);
  }, [ensureProfiles, load]);

  const profileOptions = profiles.filter((p) => p.is_active !== false);
  const usedProfileIds = new Set(
    list.filter((t) => t.id !== form.id).map((t) => t.profile_id),
  );

  function startCreate() {
    setForm(emptyForm());
    setEditing(true);
  }

  function startEdit(t: IntensiveTrainer) {
    setForm({
      id: t.id,
      profile_id: t.profile_id,
      gestalt_url: t.gestalt_url ?? '',
      full_name: t.full_name,
      photo_url: t.photo_url ?? '',
      status_line: t.status_line ?? '',
      bio: t.bio ?? '',
      specializations: t.specializations ?? '',
      phone: t.phone ?? '',
      email: t.email ?? '',
      city: t.city ?? '',
      sort_order: t.sort_order,
      is_visible: t.is_visible,
    });
    setEditing(true);
  }

  function onProfilePick(profileId: string) {
    const p = profileOptions.find((x) => x.id === profileId);
    setForm((f) => ({
      ...f,
      profile_id: profileId,
      full_name: f.full_name || p?.full_name || '',
    }));
  }

  async function loadFromSite() {
    if (!form.gestalt_url.trim()) {
      setFeedback({ type: 'err', text: 'Вставьте ссылку на gestalt.ru/author/...' });
      return;
    }
    setImporting(true);
    try {
      const data = await importFromGestaltUrl(form.gestalt_url.trim());
      setForm((f) => ({
        ...f,
        gestalt_url: data.gestalt_url ?? f.gestalt_url,
        full_name: data.full_name || f.full_name,
        photo_url: data.photo_url ?? f.photo_url,
        status_line: data.status_line ?? f.status_line,
        bio: data.bio ?? f.bio,
        specializations: data.specializations ?? f.specializations,
        phone: data.phone ?? f.phone,
        email: data.email ?? f.email,
        city: data.city ?? f.city,
      }));
      setFeedback({ type: 'ok', text: 'Данные загружены — проверьте и сохраните' });
    } catch (e) {
      setFeedback({
        type: 'err',
        text: e instanceof Error ? e.message : 'Не удалось загрузить',
      });
    } finally {
      setImporting(false);
    }
  }

  async function save() {
    if (!form.profile_id || !form.full_name.trim()) {
      setFeedback({ type: 'err', text: 'Выберите участника и укажите имя' });
      return;
    }
    const row = {
      profile_id: form.profile_id,
      gestalt_url: form.gestalt_url.trim() || null,
      full_name: form.full_name.trim(),
      photo_url: form.photo_url.trim() || null,
      status_line: form.status_line.trim() || null,
      bio: form.bio.trim() || null,
      specializations: form.specializations.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      city: form.city.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_visible: form.is_visible,
      imported_at: form.gestalt_url.trim() ? new Date().toISOString() : null,
    };
    await run(form.id ? 'Карточка обновлена' : 'Тренер добавлен', async () => {
      const { error } = form.id
        ? await supabase.from('intensive_trainers').update(row).eq('id', form.id)
        : await supabase.from('intensive_trainers').insert(row);
      if (error) throw error;
      setEditing(false);
      setForm(emptyForm());
      await load();
    });
  }

  async function remove(id: string) {
    setDeleteId(null);
    await run('Карточка удалена', async () => {
      const { error } = await supabase.from('intensive_trainers').delete().eq('id', id);
      if (error) throw error;
      await load();
    });
  }

  async function onPhotoFile(file: File) {
    const url = await uploadImage(
      'trainer-photos',
      `admin/${form.profile_id || 'new'}`,
      file,
      'supabase/migrations/008_intensive_trainers.sql',
    );
    setForm((f) => ({ ...f, photo_url: url }));
  }

  function profileLabel(p: Profile) {
    return `${p.full_name} (${ROLE_LABELS[p.role]})`;
  }

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={startCreate}>
          + Тренер
        </Button>
      </div>

      {editing && (
        <Card className="space-y-3">
          <h3 className="font-semibold">{form.id ? 'Редактирование' : 'Новый тренер'}</h3>

          <FormField label="Участник (профиль в приложении)">
            <select
              className={adminSelectClass}
              value={form.profile_id}
              disabled={Boolean(form.id)}
              onChange={(e) => onProfilePick(e.target.value)}
            >
              <option value="">— выберите —</option>
              {profileOptions.map((p) => (
                <option
                  key={p.id}
                  value={p.id}
                  disabled={usedProfileIds.has(p.id)}
                >
                  {profileLabel(p)}
                  {usedProfileIds.has(p.id) ? ' (уже в справочнике)' : ''}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Ссылка gestalt.ru">
            <Input
              value={form.gestalt_url}
              onChange={(e) => setForm((f) => ({ ...f, gestalt_url: e.target.value }))}
              placeholder="https://gestalt.ru/author/..."
            />
          </FormField>

          <Button
            type="button"
            variant="secondary"
            disabled={importing || saving}
            onClick={() => void loadFromSite()}
          >
            {importing ? 'Загрузка…' : 'Загрузить с сайта'}
          </Button>

          <FormField label="Имя в справочнике">
            <Input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </FormField>

          <FormField label="Фото">
            {form.photo_url && (
              <img src={form.photo_url} alt="" className="mb-2 h-24 w-24 rounded-lg object-cover" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void run('Фото загружено', () => onPhotoFile(file));
                }
              }}
              className="text-sm"
            />
          </FormField>

          <FormField label="Статус (с сайта)">
            <Input
              value={form.status_line}
              onChange={(e) => setForm((f) => ({ ...f, status_line: e.target.value }))}
            />
          </FormField>

          <FormField label="Город">
            <Input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </FormField>

          <FormField label="Телефон">
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </FormField>

          <FormField label="Email">
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </FormField>

          <FormField label="Описание">
            <textarea
              className={adminTextareaClass}
              rows={5}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </FormField>

          <FormField label="Специализация">
            <textarea
              className={adminTextareaClass}
              rows={3}
              value={form.specializations}
              onChange={(e) => setForm((f) => ({ ...f, specializations: e.target.value }))}
            />
          </FormField>

          <FormField label="Порядок в списке">
            <Input
              type="number"
              value={String(form.sort_order)}
              onChange={(e) =>
                setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))
              }
            />
          </FormField>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_visible}
              onChange={(e) => setForm((f) => ({ ...f, is_visible: e.target.checked }))}
            />
            Показывать в приложении
          </label>

          <div className="flex gap-2">
            <Button type="button" disabled={saving} onClick={() => void save()}>
              Сохранить
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditing(false);
                setForm(emptyForm());
              }}
            >
              Отмена
            </Button>
          </div>
        </Card>
      )}

      <ul className="space-y-2">
        {list.map((t) => {
          const p = profiles.find((x) => x.id === t.profile_id);
          return (
            <li key={t.id}>
              <Card className="flex items-start justify-between gap-2">
                <div className="flex gap-3 min-w-0">
                  {t.photo_url ? (
                    <img
                      src={t.photo_url}
                      alt=""
                      className="h-14 w-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <span className="h-14 w-14 rounded-lg bg-slate-100 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-primary-900 truncate">{t.full_name}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {p ? profileLabel(p) : '—'} {!t.is_visible && '· скрыт'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button type="button" variant="secondary" onClick={() => startEdit(t)}>
                    Изм.
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setDeleteId(t.id)}>
                    Удал.
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={deleteId !== null}
        title="Удалить карточку тренера?"
        message="Карточка исчезнет из справочника. Профиль участника останется."
        confirmLabel="Удалить"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && void remove(deleteId)}
      />
    </div>
  );
}
