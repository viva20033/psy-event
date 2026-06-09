import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, isConfigured } from '@/config/env';

let accessCode: string | null = null;
let client: SupabaseClient | null = null;

export function setAccessCode(code: string | null): void {
  accessCode = code;
  client = null;
}

export function getAccessCode(): string | null {
  return accessCode;
}

function buildHeaders(): Record<string, string> {
  return accessCode ? { 'x-access-code': accessCode } : {};
}

const FETCH_TIMEOUT_MS = 45_000;

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  if (e && typeof e === 'object') {
    const msg = String((e as { message?: string }).message ?? '');
    const details = String((e as { details?: string }).details ?? '');
    return msg.includes('AbortError') || details.includes('AbortError');
  }
  return false;
}

/** Без таймаута fetch может висеть минуту; с таймаутом — понятная ошибка вместо silent abort. */
async function fetchWithTimeout(
  url: RequestInfo | URL,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const userSignal = options.signal;
  if (userSignal) {
    if (userSignal.aborted) controller.abort();
    else userSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (isAbortError(e)) {
      throw new Error(`Сервер не ответил за ${FETCH_TIMEOUT_MS / 1000} с`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function buildClient(): SupabaseClient {
  if (!isConfigured()) {
    throw new Error(
      'Supabase не настроен: задайте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY (на Vercel — в Environment Variables, затем Redeploy).',
    );
  }
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: buildHeaders(),
      fetch: (url, options = {}) => {
        const headers = new Headers(options.headers);
        if (accessCode) {
          headers.set('x-access-code', accessCode);
        }
        return fetchWithTimeout(url, { ...options, headers });
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
