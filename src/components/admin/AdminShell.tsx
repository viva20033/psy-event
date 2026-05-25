import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface AdminShellProps {
  children: ReactNode;
}

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">Организаторам</p>
            <h1 className="text-lg font-semibold text-primary-800">Управление интенсивом</h1>
          </div>
          <Link
            to="/"
            className="shrink-0 rounded-xl bg-primary-100 px-3 py-2 text-sm font-medium text-primary-800"
          >
            ← В приложение
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 pb-8">{children}</main>
    </div>
  );
}
