import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField, adminSelectClass } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { supabase } from '@/lib/supabase/client';
import { getAccessCode } from '@/lib/supabase/client';
import { copyText, loginUrl } from '@/services/admin';
import { ROLE_LABELS, type Profile, type UserRole } from '@/types';
import type { AdminSectionProps } from '../types';

export function ParticipantsSection({
  showMessage,
  showError,
  loading,
  setLoading,
}: AdminSectionProps) {
  const [list, setList] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('client');
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('client');
  const [deactivateId, setDeactivateId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, access_code, is_active')
      .order('full_name');
    if (error) throw error;
    setList((data ?? []) as Profile[]);
  }, []);

  useEffect(() => {
    load().catch((e) => showError(e instanceof Error ? e.message : 'Ошибка загрузки'));
  }, [load, showError]);

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

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_create_profile', {
        p_access_code: getAccessCode(),
        p_full_name: name.trim(),
        p_role: role,
      });
      if (error) throw error;
      const r = data as { ok: boolean; profile?: Profile };
      if (!r.ok || !r.profile) throw new Error('Не удалось создать');
      setName('');
      await load();
      showMessage(`Создан: ${r.profile.full_name}. Код: ${r.profile.access_code}`);
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
        .from('profiles')
        .update({ full_name: editName.trim(), role: editRole })
        .eq('id', editing.id);
      if (error) throw error;
      setEditing(null);
      await load();
      showMessage('Участник сохранён');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  function randomAccessCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async function regenerateCode(p: Profile) {
    setLoading(true);
    try {
      const newCode = randomAccessCode();
      const { error: uerr } = await supabase
        .from('profiles')
        .update({ access_code: newCode })
        .eq('id', p.id);
      if (uerr) throw uerr;
      await load();
      showMessage(`Новый код для ${p.full_name}: ${newCode}`);
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  async function setActive(id: string, active: boolean) {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: active })
        .eq('id', id);
      if (error) throw error;
      setDeactivateId(null);
      await load();
      showMessage(active ? 'Участник снова активен' : 'Участник отключён');
    } catch (e) {
      showError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 bg-primary-50 border-primary-100">
        <p className="text-sm text-primary-900">
          <strong>Шаг 1.</strong> Создайте участника — появится код входа. Передайте код или ссылку лично.
          Ошиблись в имени — нажмите «Изменить».
        </p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-lg">Добавить участника</h2>
        <FormField label="Имя и фамилия" hint="Как в списке группы, например: Мария Иванова">
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
        <Button fullWidth onClick={create} disabled={loading || !name.trim()}>
          Создать и получить код
        </Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold text-lg">Список ({filtered.length})</h2>
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
          <p className="text-sm text-slate-500 py-4 text-center">Никого не найдено</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((p) => (
              <li
                key={p.id}
                className={`rounded-xl border p-3 space-y-2 ${
                  p.is_active === false ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'
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
                      showMessage(ok ? 'Код скопирован' : 'Не удалось скопировать');
                    }}
                  >
                    Копировать код
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const ok = await copyText(loginUrl(p.access_code));
                      showMessage(ok ? 'Ссылка скопирована' : 'Не удалось скопировать');
                    }}
                  >
                    Ссылка для входа
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
                  <Button size="sm" variant="ghost" onClick={() => regenerateCode(p)} disabled={loading}>
                    Новый код
                  </Button>
                  {p.is_active !== false ? (
                    <Button size="sm" variant="danger" onClick={() => setDeactivateId(p.id)}>
                      Отключить
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setActive(p.id, true)} disabled={loading}>
                      Включить снова
                    </Button>
                  )}
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
            <Button fullWidth onClick={saveEdit} disabled={loading}>Сохранить</Button>
            <Button fullWidth variant="secondary" onClick={() => setEditing(null)}>Отмена</Button>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!deactivateId}
        title="Отключить участника?"
        message="Код перестанет работать. Запись останется — можно включить снова."
        confirmLabel="Отключить"
        onConfirm={() => deactivateId && setActive(deactivateId, false)}
        onCancel={() => setDeactivateId(null)}
        loading={loading}
      />
    </div>
  );
}
