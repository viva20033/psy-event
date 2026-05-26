import type { Connection, ConnectionType, Profile } from '@/types';

export function connectionErrorMessage(code: string): string {
  switch (code) {
    case 'already_confirmed':
      return 'Эта связь уже подтверждена — повторный запрос не нужен.';
    case 'already_exists':
    case 'already_pending':
      return 'Запрос уже отправлен — ждите подтверждения.';
    case 'already_responded':
      return 'На этот запрос уже дан ответ.';
    case 'forbidden':
      return 'Нет прав ответить на этот запрос.';
    case 'not_found':
      return 'Запрос не найден.';
    case 'unauthorized':
      return 'Сессия истекла. Войдите снова.';
    default:
      return code;
  }
}

/** Активная связь requester → target (pending или confirmed). */
export function hasActiveConnection(
  connections: Connection[],
  requesterId: string,
  type: ConnectionType,
  targetProfileId?: string,
  targetGroupId?: string,
): boolean {
  return connections.some(
    (c) =>
      c.connection_type === type &&
      c.requester_id === requesterId &&
      (c.status === 'pending' || c.status === 'confirmed') &&
      ((targetProfileId && c.target_profile_id === targetProfileId) ||
        (targetGroupId && c.target_group_id === targetGroupId)),
  );
}

export function filterAvailableProfiles(
  people: Profile[],
  connections: Connection[],
  requesterId: string,
  type: ConnectionType,
): Profile[] {
  return people.filter(
    (p) => !hasActiveConnection(connections, requesterId, type, p.id),
  );
}

export function filterAvailableGroups(
  groups: { id: string }[],
  connections: Connection[],
  requesterId: string,
): { id: string }[] {
  return groups.filter(
    (g) => !hasActiveConnection(connections, requesterId, 'process_group', undefined, g.id),
  );
}

export function outgoingConnections(
  connections: Connection[],
  requesterId: string,
): Connection[] {
  return connections.filter(
    (c) => c.requester_id === requesterId && c.status === 'pending',
  );
}

export function confirmedForRequester(
  connections: Connection[],
  requesterId: string,
): Connection[] {
  return connections.filter(
    (c) => c.requester_id === requesterId && c.status === 'confirmed',
  );
}
