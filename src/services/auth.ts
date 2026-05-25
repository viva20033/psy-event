import { supabase } from '@/lib/supabase/client';
import type { Profile } from '@/types';

export async function loginWithCode(code: string): Promise<Profile> {
  const { data, error } = await supabase.rpc('login_with_code', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  const result = data as { ok: boolean; error?: string; profile?: Profile };
  if (!result.ok || !result.profile) {
    throw new Error(result.error === 'invalid_code' ? 'Неверный код доступа' : 'Ошибка входа');
  }
  return result.profile;
}
