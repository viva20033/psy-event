import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { OfficeShell, type OfficeSectionId } from '@/components/office/OfficeShell';
import { useSession } from '@/stores/session';
import { useAdminData } from '@/stores/adminData';
import { isStaffRole } from '@/types';
import { ParticipantsSection } from '@/pages/admin/sections/ParticipantsSection';
import { GroupsSection } from '@/pages/admin/sections/GroupsSection';
import { VenuesSection } from '@/pages/admin/sections/VenuesSection';
import { TrainersSection } from '@/pages/admin/sections/TrainersSection';
import { DaysSection } from '@/pages/admin/sections/DaysSection';
import { ScheduleSection } from '@/pages/admin/sections/ScheduleSection';
import { AnnouncementsSection } from '@/pages/admin/sections/AnnouncementsSection';
import { SettingsSection } from '@/pages/admin/sections/SettingsSection';
import { OfficeOverview } from './panels/OfficeOverview';
import { OfficeImportPanel } from './panels/OfficeImportPanel';
import { OfficeConnectionsPanel } from './panels/OfficeConnectionsPanel';
import { OfficeGroupsMatrix } from './panels/OfficeGroupsMatrix';

export function OfficePage() {
  const profile = useSession((s) => s.profile);
  const [section, setSection] = useState<OfficeSectionId>('overview');
  const [mounted, setMounted] = useState<Set<OfficeSectionId>>(() => new Set(['overview']));
  const prefetchCommon = useAdminData((s) => s.prefetchCommon);

  useEffect(() => {
    void prefetchCommon();
  }, [prefetchCommon]);

  useEffect(() => {
    setMounted((prev) => {
      if (prev.has(section)) return prev;
      const next = new Set(prev);
      next.add(section);
      return next;
    });
  }, [section]);

  const panels = useMemo(
    () =>
      ({
        overview: <OfficeOverview />,
        import: <OfficeImportPanel />,
        participants: <ParticipantsSection />,
        'groups-matrix': <OfficeGroupsMatrix />,
        groups: <GroupsSection />,
        connections: <OfficeConnectionsPanel />,
        venues: <VenuesSection />,
        trainers: <TrainersSection />,
        days: <DaysSection />,
        schedule: <ScheduleSection />,
        announcements: <AnnouncementsSection />,
        settings: <SettingsSection />,
      }) satisfies Record<OfficeSectionId, ReactNode>,
    [],
  );

  if (!profile || !isStaffRole(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <OfficeShell section={section} onSection={setSection}>
      {([...mounted] as OfficeSectionId[]).map((id) => (
        <div key={id} className={section === id ? 'block' : 'hidden'}>
          {panels[id]}
        </div>
      ))}
    </OfficeShell>
  );
}
