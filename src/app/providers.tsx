import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useSyncOnReconnect } from '@/hooks/useSyncOnReconnect';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000 },
  },
});

function SyncListener({ children }: { children: React.ReactNode }) {
  useSyncOnReconnect();
  return <>{children}</>;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SyncListener>{children}</SyncListener>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
