import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminTextareaClass } from '@/components/admin/FormField';
import { VenuePhotoField } from '@/components/admin/VenuePhotoField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { useAdminData } from '@/stores/adminData';
import { supabase } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils/slug';
import type { Venue } from '@/types';

const empty = (): Partial<Venue> => ({
  name: '',
  slug: '',
  description: '',
  landmark: '',
  route_hint: '',
  photo_url: '',
  sort_order: 0,
});

export function VenuesSection() {
  const { feedback, saving, run, setFeedback } = useAdminFeedback();
  const list = useAdminData((s) => s.venues);
  const ensureVenues = useAdminData((s) => s.ensureVenues);
  const patchVenue = useAdminData((s) => s.patchVenue);
  const [form, setForm] = useState<Partial<Venue> & { id?: string }>(empty());
  const [editing, setEditing] = useState(false);
  const [hideId, setHideId] = useState<string | null>(null);

  useEffect(() => {
    void ensureVenues();
  }, [ensureVenues]);

  function startCreate() {
    setForm(empty());
    setEditing(true);
  }

  function startEdit(v: Venue) {
    setForm({ ...v });
    setEditing(true);
  }

  async function save() {
    if (!form.name?.trim()) return;
    const isEdit = Boolean(form.id);
    await run(isEdit ? 'Место обновлено' : 'Место добавлено', async () => {
      const slug = form.slug?.trim() || slugify(form.name!);
      const row = {
        name: form.name!.trim(),
        slug,
        description: form.description?.trim() || null,
        landmark: form.landmark?.trim() || null,
        route_hint: form.route_hint?.trim() || null,
        photo_url: form.photo_url?.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: true,
      };
      const { data, error } = form.id
        ? await supabase.from('venues').update(row).eq('id', form.id).select().single()
        : await supabase.from('venues').insert(row).select().single();
      if (error) throw error;
      if (data) patchVenue(data.id, data as Venue);
      setEditing(false);
      setForm(empty());
      if (!isEdit) void ensureVenues(true);
    });
  }

  async function hideVenue(id: string) {
    setHideId(null);
    patchVenue(id, { is_active: false });
    try {
      const { error } = await supabase.from('venues').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      setFeedback({ type: 'ok', text: 'Место скрыто' });
    } catch (e) {
      void ensureVenues(true);
      setFeedback({ type: 'err', text: e instanceof Error ? e.message : 'Не удалось скрыть' });
    }
  }

  async function restoreVenue(id: string) {
    patchVenue(id, { is_active: true });
    try {
      const { error } = await supabase.from('venues').update({ is_active: true }).eq('id', id);
      if (error) throw error;
      setFeedback({ type: 'ok', text: 'Место снова видно' });
    } catch (e) {
      void ensureVenues(true);
      setFeedback({ type: 'err', text: e instanceof Error ? e.message : 'Не удалось вернуть' });
    }
  }

  const active = list.filter((v) => v.is_active !== false);
  const hidden = list.filter((v) => v.is_active === false);

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />
      <Card className="bg-primary-50 border-primary-100 text-sm text-primary-900">
        <strong>Места на территории.</strong> Участники видят название, ориентир, «как пройти» и фото.
        Фото можно загрузить с телефона или компьютера.
      </Card>

      <Button fullWidth onClick={startCreate}>+ Добавить место</Button>

      {editing && (
        <Card className="space-y-3 border-2 border-primary-200">
          <h3 className="font-semibold">{form.id ? 'Изменить место' : 'Новое место'}</h3>
          <FormField label="Название" hint="Например: Поляна у магнолии">
            <Input
              value={form.name ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug: f.slug || slugify(e.target.value),
                }))
              }
            />
          </FormField>
          <FormField label="Ориентир" hint="По чему узнать на месте">
            <Input
              value={form.landmark ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
            />
          </FormField>
          <FormField label="Как пройти" hint="Простыми словами, от известной точки">
            <textarea
              className={adminTextareaClass}
              value={form.route_hint ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, route_hint: e.target.value }))}
            />
          </FormField>
          <FormField label="Описание (необязательно)">
            <textarea
              className={adminTextareaClass}
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </FormField>
          <VenuePhotoField
            photoUrl={form.photo_url ?? ''}
            venueSlug={form.slug?.trim() || slugify(form.name ?? '')}
            disabled={saving}
            onChange={(url) => setForm((f) => ({ ...f, photo_url: url }))}
          />
          <FormField label="Порядок в списке" hint="Меньше число — выше в списке">
            <Input
              type="number"
              value={String(form.sort_order ?? 0)}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
            />
          </FormField>
          <Button fullWidth onClick={save} disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
          <Button fullWidth variant="secondary" onClick={() => setEditing(false)}>Отмена</Button>
        </Card>
      )}

      <Card className="space-y-2">
        <h3 className="font-semibold">На карте территории ({active.length})</h3>
        {active.map((v) => (
          <div key={v.id} className="flex justify-between items-start gap-2 border-b border-slate-100 py-2 last:border-0">
            <div>
              <p className="font-medium">{v.name}</p>
              {v.landmark && <p className="text-xs text-slate-500">{v.landmark}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button size="sm" variant="ghost" onClick={() => startEdit(v)}>Изменить</Button>
              <Button size="sm" variant="danger" onClick={() => setHideId(v.id)}>Скрыть</Button>
            </div>
          </div>
        ))}
      </Card>

      {hidden.length > 0 && (
        <Card className="space-y-2 opacity-80">
          <h3 className="font-semibold text-slate-600">Скрытые ({hidden.length})</h3>
          {hidden.map((v) => (
            <div key={v.id} className="flex justify-between py-1 text-sm">
              <span>{v.name}</span>
              <Button size="sm" onClick={() => restoreVenue(v.id)}>Вернуть</Button>
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!hideId}
        title="Скрыть место?"
        message="Участники не увидят его в списке. События с этим местом лучше поправить в расписании."
        confirmLabel="Скрыть"
        onConfirm={() => hideId && hideVenue(hideId)}
        onCancel={() => setHideId(null)}
        loading={false}
      />
    </div>
  );
}
