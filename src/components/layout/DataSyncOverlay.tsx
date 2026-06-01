/** Мягкий оверлей при фоновом обновлении кэша — вместо «прыгающих» списков. */
export function DataSyncOverlay() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/25 backdrop-blur-[1px] pointer-events-none"
      role="status"
      aria-live="polite"
      aria-label="Обновление данных"
    >
      <div className="mx-4 max-w-xs rounded-2xl bg-white/95 px-5 py-4 shadow-lg border border-slate-200 text-center pointer-events-auto">
        <div
          className="mx-auto h-8 w-8 rounded-full border-2 border-primary-200 border-t-primary-600 animate-spin"
          aria-hidden
        />
        <p className="mt-3 text-sm font-medium text-slate-800">Обновляем данные…</p>
        <p className="mt-1 text-xs text-slate-500">Секунду, всё на месте</p>
      </div>
    </div>
  );
}
