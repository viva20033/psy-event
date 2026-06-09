import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, adminTextareaClass } from '@/components/admin/FormField';
import { AdminStatusBanner } from '@/components/admin/AdminStatusBanner';
import { useAdminFeedback } from '@/hooks/useAdminFeedback';
import { useAdminData } from '@/stores/adminData';
import { supabase, getAccessCode } from '@/lib/supabase/client';
import { loginUrl } from '@/services/admin';
import { parseCsv, downloadTextFile } from '@/lib/office/csv';
import { ROLE_LABELS, type Profile, type UserRole } from '@/types';

const VALID_ROLES = new Set<string>(Object.keys(ROLE_LABELS));

export function OfficeImportPanel() {
  const { feedback, saving, run, setFeedback } = useAdminFeedback();
  const ensureProfiles = useAdminData((s) => s.ensureProfiles);
  const upsertProfile = useAdminData((s) => s.upsertProfile);
  const list = useAdminData((s) => s.profiles);
  const [csv, setCsv] = useState(
    'full_name;role\nИванов Иван;client\nПетров Пётр;therapist',
  );
  const [lastCreated, setLastCreated] = useState<Profile[]>([]);

  useEffect(() => {
    void ensureProfiles();
  }, [ensureProfiles]);

  async function importCsv() {
    const rows = parseCsv(csv);
    if (rows.length < 2) {
      setFeedback({ type: 'err', text: 'Нужна строка заголовков и хотя бы одна строка данных' });
      return;
    }
    const header = rows[0].map((h) => h.toLowerCase());
    const nameIdx = header.findIndex((h) => h === 'full_name' || h === 'имя' || h === 'name');
    const roleIdx = header.findIndex((h) => h === 'role' || h === 'роль');
    if (nameIdx < 0) {
      setFeedback({ type: 'err', text: 'Колонка full_name (или имя) обязательна' });
      return;
    }

    const created: Profile[] = [];
    const errors: string[] = [];

    await run('Импорт завершён', async () => {
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const full_name = row[nameIdx]?.trim();
        if (!full_name) continue;
        let role: UserRole = 'client';
        if (roleIdx >= 0 && row[roleIdx]) {
          const r = row[roleIdx].trim().toLowerCase();
          if (VALID_ROLES.has(r)) role = r as UserRole;
        }
        try {
          const { data, error } = await supabase.rpc('admin_create_profile', {
            p_access_code: getAccessCode(),
            p_full_name: full_name,
            p_role: role,
          });
          if (error) throw error;
          const res = data as { ok: boolean; error?: string; profile?: Profile };
          if (!res.ok || !res.profile) throw new Error(res.error ?? 'create failed');
          upsertProfile(res.profile);
          created.push(res.profile);
        } catch (e) {
          errors.push(`${full_name}: ${e instanceof Error ? e.message : 'ошибка'}`);
        }
      }
      setLastCreated(created);
      void ensureProfiles(true);
      if (errors.length) {
        setFeedback({
          type: 'err',
          text: `Создано ${created.length}, ошибок ${errors.length}. ${errors.slice(0, 3).join('; ')}`,
        });
      }
    });
  }

  function exportAllLinks() {
    const header = 'full_name;role;access_code;login_url';
    const lines = list
      .filter((p) => p.is_active !== false)
      .map(
        (p) =>
          `${p.full_name};${p.role};${p.access_code};${loginUrl(p.access_code)}`,
      );
    downloadTextFile('participants-links.csv', [header, ...lines].join('\n'));
    setFeedback({ type: 'ok', text: 'Файл скачан' });
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <AdminStatusBanner feedback={feedback} />
      <Card className="space-y-3">
        <h2 className="text-lg font-semibold">Импорт участников из CSV</h2>
        <p className="text-sm text-slate-600">
          Формат: <code className="bg-slate-100 px-1 rounded">full_name;role</code> — роль
          необязательна (по умолчанию client). Разделитель «;» или «,».
        </p>
        <FormField label="CSV">
          <textarea
            className={adminTextareaClass + ' font-mono text-sm min-h-[200px]'}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void importCsv()} disabled={saving}>
            {saving ? 'Импорт…' : 'Импортировать'}
          </Button>
          <Button variant="secondary" onClick={exportAllLinks}>
            Экспорт всех ссылок входа
          </Button>
        </div>
      </Card>

      {lastCreated.length > 0 && (
        <Card className="space-y-2">
          <h3 className="font-semibold">Создано ({lastCreated.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4">Имя</th>
                  <th className="py-2 pr-4">Код</th>
                  <th className="py-2">Ссылка</th>
                </tr>
              </thead>
              <tbody>
                {lastCreated.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{p.full_name}</td>
                    <td className="py-2 pr-4 font-mono">{p.access_code}</td>
                    <td className="py-2 text-xs break-all">{loginUrl(p.access_code)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
