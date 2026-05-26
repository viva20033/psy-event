import { supabase, getAccessCode } from '@/lib/supabase/client';
import { connectionErrorMessage } from '@/lib/connections/helpers';
import { db } from '@/lib/offline/db';
import type { Connection, ConnectionType } from '@/types';
import { useSession } from '@/stores/session';

type RpcResult = {
  ok: boolean;
  error?: string;
  connection?: Connection;
  already_pending?: boolean;
  already_responded?: boolean;
};

function parseRpcResult(data: unknown): RpcResult {
  return (data ?? { ok: false }) as RpcResult;
}

function assertRequestOk(result: RpcResult): Connection | undefined {
  if (!result.ok) {
    throw new Error(connectionErrorMessage(result.error ?? 'Ошибка'));
  }
  return result.connection;
}

export async function requestConnection(
  type: ConnectionType,
  targetProfileId?: string,
  targetGroupId?: string,
): Promise<{ connection?: Connection; alreadyPending?: boolean }> {
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
    const result = parseRpcResult(data);
    const connection = assertRequestOk(result);
    return { connection, alreadyPending: Boolean(result.already_pending) };
  }

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
  return {};
}

export async function respondConnection(
  connectionId: string,
  accept: boolean,
): Promise<{ alreadyResponded?: boolean }> {
  const code = getAccessCode();
  if (!code) throw new Error('Не авторизован');

  if (navigator.onLine) {
    const { data, error } = await supabase.rpc('respond_connection', {
      p_access_code: code,
      p_connection_id: connectionId,
      p_accept: accept,
    });
    if (error) throw error;
    const result = parseRpcResult(data);
    if (!result.ok) {
      throw new Error(connectionErrorMessage(result.error ?? 'Ошибка'));
    }
    return { alreadyResponded: Boolean(result.already_responded) };
  }

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
  return {};
}
