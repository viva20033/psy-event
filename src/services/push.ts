import { env, isConfigured } from '@/config/env';
import { supabase } from '@/lib/supabase/client';
import { useSession } from '@/stores/session';

const PUSH_PREF_KEY = 'psy-event-push-pref';

export type PushPref = 'unknown' | 'granted' | 'denied';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function getPushPref(): PushPref {
  const v = localStorage.getItem(PUSH_PREF_KEY);
  if (v === 'granted' || v === 'denied') return v;
  return 'unknown';
}

export function setPushPref(pref: PushPref): void {
  if (pref === 'unknown') localStorage.removeItem(PUSH_PREF_KEY);
  else localStorage.setItem(PUSH_PREF_KEY, pref);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function hasVapidKey(): boolean {
  return Boolean(env.vapidPublicKey);
}

export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!isConfigured() || !isPushSupported() || !hasVapidKey()) {
    return { ok: false, error: 'Push не поддерживается или не настроен на сервере' };
  }

  const profile = useSession.getState().profile;
  if (!profile) return { ok: false, error: 'Сначала войдите в приложение' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    setPushPref('denied');
    return { ok: false, error: 'Разрешение на уведомления не дано' };
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return { ok: false, error: 'Не удалось получить ключи подписки' };
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: profile.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  setPushPref('granted');
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
  } catch {
    /* ignore */
  }
  setPushPref('denied');
}

export async function notifyAnnouncementPublished(announcementId: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await supabase.functions.invoke('notify-announcement', {
      body: { announcement_id: announcementId },
    });
  } catch {
    /* edge function may be not deployed yet */
  }
}
