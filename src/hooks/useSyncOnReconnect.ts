import { useEffect } from 'react';
import { syncWhenOnline } from '@/lib/offline/sync';
import { useSession } from '@/stores/session';

export function useSyncOnReconnect() {
  const profile = useSession((s) => s.profile);

  useEffect(() => {
    if (!profile) return;

    const onOnline = () => {
      syncWhenOnline()
        .then(() => useSession.getState().setPendingSync(false))
        .catch(() => undefined);
    };

    window.addEventListener('online', onOnline);
    if (navigator.onLine) onOnline();

    return () => window.removeEventListener('online', onOnline);
  }, [profile]);
}
