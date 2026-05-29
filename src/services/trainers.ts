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

const IMPORT_FN = 'import-gestalt-trainer';

function importErrorMessage(error: { message?: string }, fallback: string): string {
  const msg = error.message ?? '';
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('Failed to send') ||
    msg.includes('NetworkError')
  ) {
    return (
      'Сервер импорта недоступен. В Supabase должна быть задеплоена Edge Function «import-gestalt-trainer» ' +
      '(терминал: npx supabase functions deploy import-gestalt-trainer --no-verify-jwt). ' +
      'Проверьте Dashboard → Edge Functions.'
    );
  }
  if (msg.includes('404') || msg.includes('not found')) {
    return `Функция «${IMPORT_FN}» не найдена в проекте Supabase — её нужно задеплоить.`;
  }
  return msg || fallback;
}

export async function importFromGestaltUrl(gestaltUrl: string): Promise<GestaltImportPreview> {
  if (!getAccessCode()) {
    throw new Error('Войдите в приложение как организатор или админ');
  }

  const { data, error } = await supabase.functions.invoke(IMPORT_FN, {
    body: { gestalt_url: gestaltUrl, mirror_photo: true },
  });

  if (error) {
    throw new Error(importErrorMessage(error, 'Не удалось вызвать функцию импорта'));
  }

  const json = data as {
    ok: boolean;
    data?: GestaltImportPreview;
    error?: string;
  } | null;

  if (!json?.ok || !json.data) {
    throw new Error(json?.error ?? 'Не удалось загрузить с сайта');
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
