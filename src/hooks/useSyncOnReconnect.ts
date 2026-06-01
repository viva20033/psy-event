import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { syncWhenOnline } from '@/lib/offline/sync';
import { useSession } from '@/stores/session';

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

export function useSyncOnReconnect() {
  const profile = useSession((s) => s.profile);
  const { pathname } = useLocation();
  const initialSyncDone = useRef(false);

  useEffect(() => {
    if (!profile) return;

    const runSync = () => {
      const skipPull = isAdminPath(window.location.pathname);
      syncWhenOnline({ skipPull })
        .then(() => useSession.getState().setPendingSync(false))
        .catch(() => undefined);
    };

    const onOnline = () => runSync();
    window.addEventListener('online', onOnline);

    if (!initialSyncDone.current && navigator.onLine && !isAdminPath(pathname)) {
      initialSyncDone.current = true;
      const t = window.setTimeout(runSync, 800);
      return () => {
        window.clearTimeout(t);
        window.removeEventListener('online', onOnline);
      };
    }

    return () => window.removeEventListener('online', onOnline);
    // pathname: если первый заход в /admin — синк отложим до выхода на обычные экраны
  }, [profile, pathname]);
}
