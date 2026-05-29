import { env } from '@/config/env';
import { getAccessCode, supabase } from '@/lib/supabase/client';
import type { GestaltImportPreview, IntensiveTrainer } from '@/types';

export async function fetchVisibleTrainers(): Promise<IntensiveTrainer[]> {
  const { data, error } = await supabase
    .from('intensive_trainers')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order')
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as IntensiveTrainer[];
}

export async function fetchTrainerByProfileId(
  profileId: string,
): Promise<IntensiveTrainer | null> {
  const { data, error } = await supabase
    .from('intensive_trainers')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  return (data as IntensiveTrainer | null) ?? null;
}

export async function fetchTrainerById(id: string): Promise<IntensiveTrainer | null> {
  const { data, error } = await supabase
    .from('intensive_trainers')
    .select('*')
    .eq('id', id)
    .eq('is_visible', true)
    .maybeSingle();
  if (error) throw error;
  return (data as IntensiveTrainer | null) ?? null;
}

export async function importFromGestaltUrl(gestaltUrl: string): Promise<GestaltImportPreview> {
  const code = getAccessCode();
  const url = `${env.supabaseUrl}/functions/v1/import-gestalt-trainer`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.supabaseAnonKey,
      ...(code ? { 'x-access-code': code } : {}),
    },
    body: JSON.stringify({ gestalt_url: gestaltUrl, mirror_photo: true }),
  });
  const json = (await res.json()) as {
    ok: boolean;
    data?: GestaltImportPreview;
    error?: string;
  };
  if (!json.ok || !json.data) {
    throw new Error(json.error ?? 'Не удалось загрузить с сайта');
  }
  return json.data;
}

export type TrainerSelfUpdate = Pick<
  IntensiveTrainer,
  'full_name' | 'bio' | 'specializations' | 'phone' | 'email' | 'city' | 'photo_url'
>;

export async function updateOwnTrainerCard(
  trainerId: string,
  patch: TrainerSelfUpdate,
): Promise<void> {
  const { error } = await supabase
    .from('intensive_trainers')
    .update({
      full_name: patch.full_name.trim(),
      bio: patch.bio?.trim() || null,
      specializations: patch.specializations?.trim() || null,
      phone: patch.phone?.trim() || null,
      email: patch.email?.trim() || null,
      city: patch.city?.trim() || null,
      photo_url: patch.photo_url?.trim() || null,
    })
    .eq('id', trainerId);
  if (error) throw error;
}
