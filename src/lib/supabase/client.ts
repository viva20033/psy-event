import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isConfigured } from '@/config/env';

let accessCode: string | null = null;
let client: SupabaseClient | null = null;

export function setAccessCode(code: string | null): void {
  accessCode = code;
}

export function getAccessCode(): string | null {
  return accessCode;
}

function buildClient(): SupabaseClient {
  if (!isConfigured()) {
    throw new Error(
      'Supabase не настроен: задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (на Vercel — в Environment Variables, затем Redeploy).',
    );
  }
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      fetch: (url, options = {}) => {
        const headers = new Headers(options.headers);
        if (accessCode) {
          headers.set('x-access-code', accessCode);
        }
        return fetch(url, { ...options, headers });
      },
    },
  });
}

/** Ленивая инициализация — не падает при импорте, если env пустой (частая причина белого экрана на Vercel). */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = buildClient();
  }
  return client;
}

/** Совместимость: первый вызов API создаёт клиент. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getSupabase();
    const value = Reflect.get(c, prop, c);
    return typeof value === 'function' ? value.bind(c) : value;
  },
});
