import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type OfficeSectionId =
  | 'overview'
  | 'import'
  | 'participants'
  | 'groups-matrix'
  | 'groups'
  | 'connections'
  | 'venues'
  | 'trainers'
  | 'days'
  | 'schedule'
  | 'announcements'
  | 'settings';

const NAV: { id: OfficeSectionId; label: string; group: string }[] = [
  { id: 'overview', label: 'Обзор', group: 'Главное' },
  { id: 'import', label: 'Импорт CSV', group: 'Главное' },
  { id: 'participants', label: 'Участники', group: 'Люди' },
  { id: 'groups-matrix', label: 'Группы (таблица)', group: 'Люди' },
  { id: 'groups', label: 'Группы (редактор)', group: 'Люди' },
  { id: 'connections', label: 'Связи', group: 'Люди' },
  { id: 'trainers', label: 'Тренеры', group: 'Контент' },
  { id: 'venues', label: 'Места', group: 'Контент' },
  { id: 'days', label: 'Дни', group: 'Расписание' },
  { id: 'schedule', label: 'События', group: 'Расписание' },
  { id: 'announcements', label: 'Объявления', group: 'Контент' },
  { id: 'settings', label: 'Настройки', group: 'Система' },
];

interface OfficeShellProps {
  section: OfficeSectionId;
  onSection: (id: OfficeSectionId) => void;
  children: ReactNode;
}

export function OfficeShell({ section, onSection, children }: OfficeShellProps) {
  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Центр управления
            </p>
            <h1 className="text-xl font-bold text-primary-900">МГИ Сочи — office</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link
              to="/admin"
              className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:bg-slate-50"
            >
              Моб. админка
            </Link>
            <Link
              to="/"
              className="rounded-lg bg-primary-100 px-3 py-2 font-medium text-primary-800"
            >
              ← Приложение
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-0 lg:gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-4">
            {groups.map((group) => (
              <div key={group}>
                <p className="mb-1 px-2 text-xs font-semibold uppercase text-slate-400">{group}</p>
                <ul className="space-y-0.5">
                  {NAV.filter((n) => n.group === group).map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onSection(item.id)}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors',
                          section === item.id
                            ? 'bg-primary-700 font-medium text-white'
                            : 'text-slate-700 hover:bg-white',
                        )}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 lg:hidden">
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={section}
              onChange={(e) => onSection(e.target.value as OfficeSectionId)}
            >
              {NAV.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
          <div className="office-panel">{children}</div>
        </main>
      </div>
    </div>
  );
}
