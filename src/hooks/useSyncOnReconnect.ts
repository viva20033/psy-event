import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { syncWhenOnline } from '@/lib/offline/sync';
import { useSession } from '@/stores/session';

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

export function useSyncOnReconnect() {
  const profile = useSession((s) => s.profile);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!profile) return;

    const onOnline = () => {
      const skipPull = isAdminPath(window.location.pathname);
      syncWhenOnline({ skipPull })
        .then(() => useSession.getState().setPendingSync(false))
        .catch(() => undefined);
    };

    window.addEventListener('online', onOnline);
    if (navigator.onLine && !isAdminPath(pathname)) {
      const t = window.setTimeout(onOnline, 800);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener('online', onOnline);
      };
    }

    return () => window.removeEventListener('online', onOnline);
  }, [profile, pathname]);
}
