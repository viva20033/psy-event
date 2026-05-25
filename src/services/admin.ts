import { pullAllData } from '@/lib/offline/sync';

/** Фоновое обновление кэша приложения (не блокирует сохранение в админке) */
export function refreshAppData(): void {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), 12_000);
  });
  void Promise.race([pullAllData(), timeout]).catch(() => undefined);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function loginUrl(accessCode: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/login?code=${encodeURIComponent(accessCode)}`;
}
