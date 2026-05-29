import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminShell } from '@/components/admin/AdminShell';
import { useSession } from '@/stores/session';
import { useAdminData } from '@/stores/adminData';
import { isStaffRole } from '@/types';
import { cn } from '@/lib/utils/cn';
import { ParticipantsSection } from './sections/ParticipantsSection';
import { VenuesSection } from './sections/VenuesSection';
import { DaysSection } from './sections/DaysSection';
import { ScheduleSection } from './sections/ScheduleSection';
import { GroupsSection } from './sections/GroupsSection';
import { AnnouncementsSection } from './sections/AnnouncementsSection';
import { SettingsSection } from './sections/SettingsSection';
import { TrainersSection } from './sections/TrainersSection';

type Tab =
  | 'participants'
  | 'venues'
  | 'trainers'
  | 'days'
  | 'schedule'
  | 'groups'
  | 'announcements'
  | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'participants', label: 'Участники', icon: '👤' },
  { id: 'venues', label: 'Места', icon: '📍' },
  { id: 'trainers', label: 'Тренеры', icon: '🎓' },
  { id: 'days', label: 'Дни', icon: '📆' },
  { id: 'schedule', label: 'Расписание', icon: '🕐' },
  { id: 'groups', label: 'Группы', icon: '👥' },
  { id: 'announcements', label: 'Объявления', icon: '📢' },
  { id: 'settings', label: 'Настройки', icon: '⚙️' },
];

export function AdminPage() {
  const profile = useSession((s) => s.profile);
  const [tab, setTab] = useState<Tab>('participants');
  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(() => new Set(['participants']));
  const prefetchCommon = useAdminData((s) => s.prefetchCommon);

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, [tab]);

  useEffect(() => {
    void prefetchCommon();
  }, [prefetchCommon]);

  const tabPanels = useMemo(
    () =>
      ({
        participants: <ParticipantsSection />,
        venues: <VenuesSection />,
        trainers: <TrainersSection />,
        days: <DaysSection />,
        schedule: <ScheduleSection />,
        groups: <GroupsSection />,
        announcements: <AnnouncementsSection />,
        settings: <SettingsSection />,
      }) satisfies Record<Tab, ReactNode>,
    [],
  );

  if (!profile || !isStaffRole(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <AdminShell>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border px-2 py-3 text-xs font-medium min-h-[72px]',
                tab === t.id
                  ? 'border-primary-600 bg-primary-700 text-white'
                  : 'border-slate-200 bg-white text-slate-700 active:bg-slate-50',
              )}
            >
              <span className="text-xl mb-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Вкладка монтируется при первом открытии и остаётся в DOM — без повторной загрузки */}
        {TABS.map((t) =>
          mountedTabs.has(t.id) ? (
            <div key={t.id} className={tab === t.id ? '' : 'hidden'}>
              {tabPanels[t.id]}
            </div>
          ) : null,
        )}
      </div>
    </AdminShell>
  );
}
