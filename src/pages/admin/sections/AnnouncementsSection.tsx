import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PriorityBadge } from '@/components/ui/Badge';
import { FormField, adminSelectClass, adminTextareaClass } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { supabase } from '@/lib/supabase/client';
import { PRIORITY_LABELS, type Announcement, type AnnouncementPriority } from '@/types';

export function AnnouncementsSection() {
  const { feedback, saving, run } = useAdminFeedback();
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
    load().catch(() => undefined);
  }, [load]);

  async function saveNew() {
    if (!title.trim() || !body.trim()) return;
    await run('Объявление опубликовано', async () => {
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
    });
  }

  async function saveEdit() {
    if (!editing) return;
    await run('Объявление сохранено', async () => {
      const { error } = await supabase
        .from('announcements')
        .update({ title: title.trim(), body: body.trim(), priority })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      setTitle('');
      setBody('');
      await load();
    });
  }

  async function togglePublish(a: Announcement) {
    await run(a.is_published ? 'Снято с публикации' : 'Снова опубликовано', async () => {
      const { error } = await supabase
        .from('announcements')
        .update({ is_published: !a.is_published })
        .eq('id', a.id);
      if (error) throw error;
      await load();
    });
  }

  async function remove(id: string) {
    await run('Объявление удалено', async () => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
      setDeleteId(null);
      await load();
    });
  }

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />

      <Card className="bg-amber-50 border-amber-200 text-sm text-amber-900">
        После «Опубликовать» появится <strong>зелёное сообщение</strong> вверху. Срочные — на главном экране у всех.
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
            <Button fullWidth onClick={saveEdit} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить изменения'}
            </Button>
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
          <Button fullWidth onClick={saveNew} disabled={saving || !title.trim() || !body.trim()}>
            {saving ? 'Публикация…' : 'Опубликовать'}
          </Button>
        )}
      </Card>

      <Card className="space-y-3">
        <h3 className="font-semibold">Все объявления ({list.length})</h3>
        {list.map((a) => (
          <div key={a.id} className={`rounded-xl border p-3 space-y-2 ${!a.is_published ? 'opacity-60' : ''}`}>
            <div className="flex justify-between gap-2">
              <p className="font-medium">{a.title}</p>
              <PriorityBadge priority={a.priority} />
            </div>
            <p className="text-sm text-slate-600 line-clamp-2">{a.body}</p>
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
              <Button size="sm" variant="secondary" onClick={() => togglePublish(a)} disabled={saving}>
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
        message="Оно исчезнет у всех участников. Отменить нельзя."
        confirmLabel="Удалить"
        onConfirm={() => deleteId && remove(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={saving}
      />
    </div>
  );
}
