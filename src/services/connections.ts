import { supabase, getAccessCode } from '@/lib/supabase/client';
import { db } from '@/lib/offline/db';
import type { ConnectionType } from '@/types';
import { useSession } from '@/stores/session';

export async function requestConnection(
  type: ConnectionType,
  targetProfileId?: string,
  targetGroupId?: string,
): Promise<void> {
  const code = getAccessCode();
  if (!code) throw new Error('Не авторизован');

  if (navigator.onLine) {
    const { data, error } = await supabase.rpc('request_connection', {
      p_access_code: code,
      p_type: type,
      p_target_profile_id: targetProfileId ?? null,
      p_target_group_id: targetGroupId ?? null,
    });
    if (error) throw error;
    const result = data as { ok: boolean; error?: string };
    if (!result.ok) throw new Error(result.error ?? 'Ошибка');
  } else {
    await db.syncQueue.add({
      action: 'request_connection',
      payload: {
        p_type: type,
        p_target_profile_id: targetProfileId ?? null,
        p_target_group_id: targetGroupId ?? null,
      },
      createdAt: Date.now(),
      status: 'pending',
    });
    useSession.getState().setPendingSync(true);
  }
}

export async function respondConnection(
  connectionId: string,
  accept: boolean,
): Promise<void> {
  const code = getAccessCode();
  if (!code) throw new Error('Не авторизован');

  if (navigator.onLine) {
    const { data, error } = await supabase.rpc('respond_connection', {
      p_access_code: code,
      p_connection_id: connectionId,
      p_accept: accept,
    });
    if (error) throw error;
    const result = data as { ok: boolean };
    if (!result.ok) throw new Error('Ошибка');
  } else {
    await db.syncQueue.add({
      action: 'respond_connection',
      payload: {
        p_connection_id: connectionId,
        p_accept: accept,
      },
      createdAt: Date.now(),
      status: 'pending',
    });
    useSession.getState().setPendingSync(true);
  }
}
