import { isConfigured } from '@/config/env';

export function ConfigGuard({ children }: { children: React.ReactNode }) {
  if (isConfigured()) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-6">
      <div className="max-w-md rounded-2xl bg-white p-6 shadow-lg space-y-3 text-center">
        <h1 className="text-xl font-bold text-primary-900">Нужна настройка Supabase</h1>
        <p className="text-sm text-slate-600">
          На сервере не заданы переменные окружения. Vite подставляет их только при{' '}
          <strong>сборке</strong>, поэтому после добавления в Vercel нужен Redeploy.
        </p>
        <ul className="text-left text-sm text-slate-700 space-y-1">
          <li>
            <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_URL</code>
          </li>
          <li>
            <code className="bg-slate-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code>
          </li>
          <li>
            <code className="bg-slate-100 px-1 rounded">VITE_ORGANIZER_PHONE</code> (необязательно)
          </li>
        </ul>
        <p className="text-xs text-slate-500">
          Vercel → Project → Settings → Environment Variables → Production → Redeploy
        </p>
      </div>
    </div>
  );
}
