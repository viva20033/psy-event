import { isAfter, isBefore, isWithinInterval, parseISO } from 'date-fns';
import type { EventDay, ScheduleEvent, UserRole } from '@/types';

export function resolveActiveVenue(
  event: ScheduleEvent,
  rainMode: boolean,
) {
  if (rainMode && event.backup_venue) return event.backup_venue;
  return event.venue ?? null;
}

export function getCurrentAndNext(
  events: ScheduleEvent[],
  now = new Date(),
): { current: ScheduleEvent | null; next: ScheduleEvent | null } {
  const sorted = [...events].sort(
    (a, b) => parseISO(a.starts_at).getTime() - parseISO(b.starts_at).getTime(),
  );
  let current: ScheduleEvent | null = null;
  let next: ScheduleEvent | null = null;

  for (const e of sorted) {
    const start = parseISO(e.starts_at);
    const end = parseISO(e.ends_at);
    if (isWithinInterval(now, { start, end })) {
      current = e;
    } else if (isAfter(start, now) && !next) {
      next = e;
    }
  }
  if (!current && !next && sorted.length) {
    const last = sorted[sorted.length - 1];
    if (isBefore(parseISO(last.ends_at), now)) return { current: null, next: null };
  }
  return { current, next };
}

export function getTodayEvents(
  events: ScheduleEvent[],
  day: EventDay | undefined,
): ScheduleEvent[] {
  if (!day) return [];
  return events
    .filter((e) => e.event_day_id === day.id)
    .sort((a, b) => parseISO(a.starts_at).getTime() - parseISO(b.starts_at).getTime());
}

export function findCurrentDay(
  days: EventDay[],
  now = new Date(),
): EventDay | undefined {
  const withDates = days.filter((d) => d.event_date);
  if (withDates.length) {
    const today = now.toISOString().slice(0, 10);
    const match = withDates.find((d) => d.event_date === today);
    if (match) return match;
  }
  return days.find((d) => !d.is_rest_day) ?? days[0];
}

export const ROLE_LABELS_SHORT: Record<UserRole, string> = {
  client: 'Клиент',
  therapist: 'Терапевт',
  supervisor: 'Супервизор',
  hypervisor: 'Гипервизор',
  organizer: 'Организатор',
  admin: 'Админ',
};
