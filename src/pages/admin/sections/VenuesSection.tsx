import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminTextareaClass } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { supabase } from '@/lib/supabase/client';
import { slugify } from '@/lib/utils/slug';
import { refreshAppData } from '@/services/admin';
import type { Venue } from '@/types';
import type { AdminSectionProps } from '../types';

const empty = (): Partial<Venue> => ({
  name: '',
  slug: '',
  description: '',
  landmark: '',
  route_hint: '',
  photo_url: '',
  sort_order: 0,
});

export function VenuesSection({ showMessage, showError, loading, setLoading }: AdminSectionProps) {
  const [list, setList] = useState<Venue[]>([]);
  const [form, setForm] = useState<Partial<Venue> & { id?: string }>(empty());
  const [editing, setEditing] = useState(false);
  const [hideId, setHideId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('venues').select('*').order('sort_order');
    if (error) throw error;
    setList((data ?? []) as Venue[]);
  }, []);

  useEffect(() => {
    load().catch((e) => showError(e instanceof Error ? e.message : 'Ошибка'));
  }, [load, showError]);

  function startCreate() {
    setForm(empty());
    setEditing(true);
  }

  function startEdit(v: Venue) {
    setForm({ ...v });
    setEditing(true);
  }

  async function save() {
    if (!form.name?.trim()) {
      showError('Укажите название места');
      return;
    }
    setLoading(true);
    try {
      const slug = form.slug?.trim() || slugify(form.name);
      const row = {
        name: form.name.trim(),
        slug,
        description: form.description?.trim() || null,
        landmark: form.landmark?.trim() || null,
        route_hint: form.route_hint?.trim() || null,
        photo_url: form.photo_url?.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: true,
      };
      if (form.id) {
        const { error } = await supabase.from('venues').update(row).eq('id', form.id);
        if (error) throw error;
        showMessage('Место обновлено');
      } else {
        const { error } = await supabase.from('venues').insert(row);
        if (error) throw error;
        showMessage('Место добавлено');
      }
      setEditing(false);
      setForm(empty());
      await load();
      await refreshAppData();
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function hideVenue(id: string) {
    setLoading(true);
    try {
      const { error } = await supabase.from('venues').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      setHideId(null);
      await load();
      await refreshAppData();
      showMessage('Место скрыто (не удалено)');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  const active = list.filter((v) => v.is_active !== false);
  const hidden = list.filter((v) => v.is_active === false);

  return (
    <div className="space-y-4">
      <Card className="bg-primary-50 border-primary-100 text-sm text-primary-900">
        <strong>Места на территории.</strong> Участники видят название, ориентир и «как пройти».
        Фото — вставьте ссылку (загрузите файл в Supabase Storage → скопируйте публичную ссылку).
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
          <FormField label="Ссылка на фото (необязательно)">
            <Input
              value={form.photo_url ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, photo_url: e.target.value }))}
              placeholder="https://..."
            />
          </FormField>
          <FormField label="Порядок в списке" hint="Меньше число — выше в списке">
            <Input
              type="number"
              value={String(form.sort_order ?? 0)}
              onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
            />
          </FormField>
          <Button fullWidth onClick={save} disabled={loading}>Сохранить</Button>
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
              <Button
                size="sm"
                onClick={async () => {
                  await supabase.from('venues').update({ is_active: true }).eq('id', v.id);
                  await load();
                  showMessage('Место снова видно');
                }}
              >
                Вернуть
              </Button>
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
        loading={loading}
      />
    </div>
  );
}
