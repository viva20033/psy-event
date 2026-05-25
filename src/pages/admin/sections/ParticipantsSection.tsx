import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminSelectClass } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { supabase } from '@/lib/supabase/client';
import { getAccessCode } from '@/lib/supabase/client';
import { copyText, loginUrl } from '@/services/admin';
import { ROLE_LABELS, type Profile, type UserRole } from '@/types';

export function ParticipantsSection() {
  const { feedback, saving, run, setFeedback } = useAdminFeedback();
  const [list, setList] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('client');
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [listLoading, setListLoading] = useState(false);

  const load = useCallback(async () => {
    setListLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, access_code, is_active')
        .order('full_name');
      if (error) throw error;
      setList((data ?? []) as Profile[]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch((e) =>
      setFeedback({ type: 'err', text: e instanceof Error ? e.message : 'Не удалось загрузить список' }),
    );
  }, [load, setFeedback]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (!showInactive && p.is_active === false) return false;
      if (!q) return true;
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.access_code.toLowerCase().includes(q)
      );
    });
  }, [list, search, showInactive]);

  function randomAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  async function create() {
    if (!name.trim()) return;
    await run(`Создан участник. Код появится в списке ниже.`, async () => {
      const { data, error } = await supabase.rpc('admin_create_profile', {
        p_access_code: getAccessCode(),
        p_full_name: name.trim(),
        p_role: role,
      });
      if (error) throw error;
      const r = data as { ok: boolean; error?: string; profile?: Profile };
      if (!r.ok || !r.profile) throw new Error(r.error ?? 'Не удалось создать');
      setName('');
      await load();
      setFeedback({
        type: 'ok',
        text: `Готово: ${r.profile.full_name}, код ${r.profile.access_code}`,
      });
    });
  }

  async function saveEdit() {
    if (!editing) return;
    await run('Изменения сохранены', async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName.trim(), role: editRole })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      await load();
    });
  }

  async function regenerateCode(p: Profile) {
    await run(`Новый код для ${p.full_name} — смотрите в списке`, async () => {
      const newCode = randomAccessCode();
      const { error } = await supabase
        .from('profiles')
        .update({ access_code: newCode })
        .eq('id', p.id);
      if (error) throw error;
      await load();
    });
  }

  async function setActive(id: string, active: boolean) {
    await run(active ? 'Участник снова активен' : 'Участник отключён', async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: active })
        .eq('id', id);
      if (error) throw error;
      setDeactivateId(null);
      await load();
    });
  }

  async function deleteProfile(p: Profile) {
    await run(`Запись «${p.full_name}» удалена`, async () => {
      const { error } = await supabase.from('profiles').delete().eq('id', p.id);
      if (error) throw error;
      setDeleteTarget(null);
      await load();
    });
  }

  return (
    <div className="space-y-4">
      <AdminStatusBanner feedback={feedback} />

      <Card className="space-y-3 bg-primary-50 border-primary-100 text-sm text-primary-900">
        После «Создать» подождите зелёное сообщение и проверьте список. Дубликаты можно{' '}
        <strong>удалить</strong> (с подтверждением).
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-lg">Добавить участника</h2>
        <FormField label="Имя и фамилия">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия" />
        </FormField>
        <FormField label="Роль">
          <select
            className={adminSelectClass}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </FormField>
        <Button fullWidth onClick={create} disabled={saving || !name.trim()}>
          {saving ? 'Создание…' : 'Создать и получить код'}
        </Button>
      </Card>

      <Card className="space-y-3">
        <div className="flex justify-between items-center gap-2">
          <h2 className="font-semibold text-lg">Список ({filtered.length})</h2>
          <Button size="sm" variant="secondary" onClick={() => load()} disabled={listLoading}>
            {listLoading ? '…' : 'Обновить'}
          </Button>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или коду"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Показать отключённых
        </label>

        {filtered.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            {listLoading ? 'Загрузка…' : 'Никого не найдено — нажмите «Обновить»'}
          </p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((p) => (
              <li
                key={p.id}
                className={`rounded-xl border p-3 space-y-2 ${
                  p.is_active === false ? 'bg-slate-50 opacity-75' : 'bg-white'
                }`}
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium">{p.full_name}</p>
                    <p className="text-xs text-slate-500">{ROLE_LABELS[p.role]}</p>
                  </div>
                  <p className="font-mono text-sm font-bold text-primary-700">{p.access_code}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const ok = await copyText(p.access_code);
                      setFeedback({ type: ok ? 'ok' : 'err', text: ok ? 'Код скопирован' : 'Не удалось скопировать' });
                    }}
                  >
                    Код
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const ok = await copyText(loginUrl(p.access_code));
                      setFeedback({ type: ok ? 'ok' : 'err', text: ok ? 'Ссылка скопирована' : 'Не удалось' });
                    }}
                  >
                    Ссылка
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(p);
                      setEditName(p.full_name);
                      setEditRole(p.role);
                    }}
                  >
                    Изменить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => regenerateCode(p)} disabled={saving}>
                    Новый код
                  </Button>
                  {p.is_active !== false ? (
                    <Button size="sm" variant="danger" onClick={() => setDeactivateId(p.id)}>
                      Отключить
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setActive(p.id, true)} disabled={saving}>
                      Включить
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(p)}>
                    Удалить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg space-y-3">
            <h3 className="font-semibold">Изменить участника</h3>
            <FormField label="Имя">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </FormField>
            <FormField label="Роль">
              <select
                className={adminSelectClass}
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </FormField>
            <Button fullWidth onClick={saveEdit} disabled={saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
            <Button fullWidth variant="secondary" onClick={() => setEditing(null)}>Отмена</Button>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!deactivateId}
        title="Отключить участника?"
        message="Код перестанет работать. Запись останется в базе."
        confirmLabel="Отключить"
        onConfirm={() => deactivateId && setActive(deactivateId, false)}
        onCancel={() => setDeactivateId(null)}
        loading={saving}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Удалить участника навсегда?"
        message={
          deleteTarget
            ? `Будет удалён: ${deleteTarget.full_name} (код ${deleteTarget.access_code}). Это нельзя отменить. Дубликаты лучше удалить так.`
            : ''
        }
        confirmLabel="Да, удалить"
        onConfirm={() => deleteTarget && deleteProfile(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        loading={saving}
      />
    </div>
  );
}
