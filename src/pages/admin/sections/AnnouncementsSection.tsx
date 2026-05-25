import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PriorityBadge } from '@/components/ui/Badge';
import { FormField, adminSelectClass, adminTextareaClass } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { supabase } from '@/lib/supabase/client';
import { refreshAppData } from '@/services/admin';
import { PRIORITY_LABELS, type Announcement, type AnnouncementPriority } from '@/types';
import type { AdminSectionProps } from '../types';

export function AnnouncementsSection({
  showMessage,
  showError,
  loading,
  setLoading,
}: AdminSectionProps) {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<AnnouncementPriority>('normal');
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('published_at', { ascending: false });
    if (error) throw error;
    setList((data ?? []) as Announcement[]);
  }, []);

  useEffect(() => {
    load().catch((e) => showError(e instanceof Error ? e.message : 'Ошибка'));
  }, [load, showError]);

  async function saveNew() {
    if (!title.trim() || !body.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: title.trim(),
        body: body.trim(),
        priority,
        is_published: true,
      });
      if (error) throw error;
      setTitle('');
      setBody('');
      setPriority('normal');
      await load();
      await refreshAppData();
      showMessage('Объявление опубликовано');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          title: title.trim(),
          body: body.trim(),
          priority,
        })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      await load();
      await refreshAppData();
      showMessage('Объявление сохранено');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function togglePublish(a: Announcement) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_published: !a.is_published })
        .eq('id', a.id);
      if (error) throw error;
      await load();
      await refreshAppData();
      showMessage(a.is_published ? 'Снято с публикации' : 'Снова опубликовано');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    setLoading(true);
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setDeleteId(null);
      await load();
      await refreshAppData();
      showMessage('Объявление удалено');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="bg-amber-50 border-amber-200 text-sm text-amber-900">
        <strong>Срочные</strong> показываются на главном экране у всех. Перед публикацией проверьте текст —
        опечатку можно исправить кнопкой «Изменить».
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">{editing ? 'Изменить объявление' : 'Новое объявление'}</h3>
        <FormField label="Заголовок">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Текст">
          <textarea className={adminTextareaClass} value={body} onChange={(e) => setBody(e.target.value)} />
        </FormField>
        <FormField label="Важность">
          <select
            className={adminSelectClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value as AnnouncementPriority)}
          >
            {(Object.keys(PRIORITY_LABELS) as AnnouncementPriority[]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
        </FormField>
        {editing ? (
          <>
            <Button fullWidth onClick={saveEdit} disabled={loading}>Сохранить изменения</Button>
            <Button
              fullWidth
              variant="secondary"
              onClick={() => {
                setEditing(null);
                setTitle('');
                setBody('');
              }}
            >
              Отмена
            </Button>
          </>
        ) : (
          <Button fullWidth onClick={saveNew} disabled={loading || !title || !body}>
            Опубликовать
          </Button>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Все объявления</h3>
        {list.map((a) => (
          <div key={a.id} className={`rounded-xl border p-3 space-y-2 ${!a.is_published ? 'opacity-60' : ''}`}>
            <div className="flex justify-between gap-2">
              <p className="font-medium">{a.title}</p>
              <PriorityBadge priority={a.priority} />
            </div>
            <p className="text-sm text-slate-600 line-clamp-2">{a.body}</p>
            {!a.is_published && <p className="text-xs text-amber-700">Не опубликовано</p>}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(a);
                  setTitle(a.title);
                  setBody(a.body);
                  setPriority(a.priority);
                }}
              >
                Изменить
              </Button>
              <Button size="sm" variant="secondary" onClick={() => togglePublish(a)}>
                {a.is_published ? 'Снять' : 'Опубликовать'}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleteId(a.id)}>
                Удалить
              </Button>
            </div>
          </div>
        ))}
      </Card>

      <ConfirmDialog
        open={!!deleteId}
        title="Удалить объявление?"
        message="Оно исчезнет у всех участников."
        onConfirm={() => deleteId && remove(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={loading}
      />
    </div>
  );
}
