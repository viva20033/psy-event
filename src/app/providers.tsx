import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useSyncOnReconnect } from '@/hooks/useSyncOnReconnect';
import { useSession } from '@/stores/session';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 },
  },
});

function SyncListener({ children }: { children: React.ReactNode }) {
  useSyncOnReconnect();
  return <>{children}</>;
}

/** Без этого на проде возможен вечный «пустой» экран: isHydrated не становится true. */
function SessionHydration({ children }: { children: React.ReactNode }) {
  const hydrate = useSession((s) => s.hydrate);

  useEffect(() => {
    const finish = () => hydrate();
    if (useSession.persist.hasHydrated()) {
      finish();
      return;
    }
    return useSession.persist.onFinishHydration(finish);
  }, [hydrate]);

  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionHydration>
          <SyncListener>{children}</SyncListener>
        </SessionHydration>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
