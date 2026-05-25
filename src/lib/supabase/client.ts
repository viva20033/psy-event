import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

let accessCode: string | null = null;

export function setAccessCode(code: string | null): void {
  accessCode = code;
}

export function getAccessCode(): string | null {
  return accessCode;
}

function createSupabaseClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: {
      headers: {},
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

export const supabase = createSupabaseClient();

export type Database = {
  public: {
    Tables: Record<string, unknown>;
    Functions: Record<string, unknown>;
  };
};
