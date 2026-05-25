import { AppProviders } from '@/app/providers';
import { AppRouter } from '@/app/router';
import { ConfigGuard } from '@/components/ConfigGuard';

export function App() {
  return (
    <ConfigGuard>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ConfigGuard>
  );
}
