import { Navigate, Route, Routes } from 'react-router-dom';
import { useSession } from '@/stores/session';
import { isStaffRole } from '@/types';
import { LoginPage } from '@/pages/LoginPage';
import { TodayPage } from '@/pages/TodayPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { ConnectionsPage } from '@/pages/ConnectionsPage';
import { TerritoryPage } from '@/pages/TerritoryPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { LostPage } from '@/pages/LostPage';
import { AdminPage } from '@/pages/admin/AdminPage';
import { ChatPage } from '@/pages/ChatPage';
import { isFeatureEnabled } from '@/config/feature-flags';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const profile = useSession((s) => s.profile);
  const hydrated = useSession((s) => s.isHydrated);
  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-500">
        Загрузка…
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireStaff({ children }: { children: React.ReactNode }) {
  const profile = useSession((s) => s.profile);
  if (!profile || !isStaffRole(profile.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function AppRouter() {
  const profile = useSession((s) => s.profile);
  const hydrated = useSession((s) => s.isHydrated);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          hydrated && profile ? <Navigate to="/" replace /> : <LoginPage />
        }
      />
      <Route path="/" element={<RequireAuth><TodayPage /></RequireAuth>} />
      {isFeatureEnabled('chat') && (
        <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />
      )}
      <Route path="/schedule" element={<RequireAuth><SchedulePage /></RequireAuth>} />
      <Route path="/connections" element={<RequireAuth><ConnectionsPage /></RequireAuth>} />
      <Route path="/territory" element={<RequireAuth><TerritoryPage /></RequireAuth>} />
      <Route path="/announcements" element={<RequireAuth><AnnouncementsPage /></RequireAuth>} />
      <Route path="/lost" element={<RequireAuth><LostPage /></RequireAuth>} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireStaff>
              <AdminPage />
            </RequireStaff>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
