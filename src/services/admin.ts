import { pullAllData } from '@/lib/offline/sync';

/** После любого изменения в админке — обновить кэш участников */
export async function refreshAppData(): Promise<void> {
  try {
    await pullAllData();
  } catch {
    // офлайн — не критично для админки
  }
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
