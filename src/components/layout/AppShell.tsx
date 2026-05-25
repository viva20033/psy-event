import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils/cn';
import { Link } from 'react-router-dom';
import { useSession } from '@/stores/session';
import { isStaffRole } from '@/types';

const tabs = [
  { to: '/', label: 'Сегодня', icon: '📍' },
  { to: '/schedule', label: 'Расписание', icon: '📅' },
  { to: '/connections', label: 'Связи', icon: '🔗' },
  { to: '/territory', label: 'Территория', icon: '🗺️' },
  { to: '/announcements', label: 'Объявления', icon: '📢' },
] as const;

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AppShell({ children, title }: AppShellProps) {
  const pendingSync = useSession((s) => s.pendingSync);
  const profile = useSession((s) => s.profile);

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="text-lg font-semibold text-primary-800">
            {title ?? 'МГИ Сочи'}
          </h1>
          {pendingSync && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
              Ожидает синхронизации
            </span>
          )}
          {profile && isStaffRole(profile.role) && (
            <Link to="/admin" className="text-sm text-primary-600 font-medium">
              Админ
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg justify-around">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs',
                  isActive ? 'text-primary-700 font-semibold' : 'text-slate-500',
                )
              }
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}