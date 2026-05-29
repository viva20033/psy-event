import { supabase, getAccessCode } from '@/lib/supabase/client';
import { db, setLastSyncTime } from '@/lib/offline/db';
import type {
  Announcement,
  Connection,
  EventDay,
  IntensiveTrainer,
  ScheduleEvent,
  Venue,
} from '@/types';

export async function pullAllData(): Promise<void> {
  await Promise.all([
    pullVenues(),
    pullIntensiveTrainers(),
    pullEventDays(),
    pullSchedule(),
    pullAnnouncements(),
    pullConnections(),
    pullSettings(),
  ]);
}

export async function pullVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  const venues = (data ?? []) as Venue[];
  await db.venues.clear();
  await db.venues.bulkPut(venues);
  await setLastSyncTime('venues');
  return venues;
}

export async function pullIntensiveTrainers(): Promise<IntensiveTrainer[]> {
  const { data, error } = await supabase
    .from('intensive_trainers')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order')
    .order('full_name');
  if (error) throw error;
  const trainers = (data ?? []) as IntensiveTrainer[];
  await db.intensiveTrainers.clear();
  await db.intensiveTrainers.bulkPut(trainers);
  await setLastSyncTime('intensiveTrainers');
  return trainers;
}

export async function pullEventDays(): Promise<EventDay[]> {
  const { data, error } = await supabase
    .from('event_days')
    .select('*')
    .order('day_index');
  if (error) throw error;
  const days = (data ?? []) as EventDay[];
  await db.eventDays.clear();
  await db.eventDays.bulkPut(days);
  await setLastSyncTime('eventDays');
  return days;
}

export async function pullSchedule(): Promise<ScheduleEvent[]> {
  const { data: events, error } = await supabase
    .from('schedule_events')
    .select('*')
    .order('starts_at');
  if (error) throw error;
  const { data: venues } = await supabase.from('venues').select('*');
  const venueMap = new Map((venues ?? []).map((v) => [v.id, v]));
  const enriched = ((events ?? []) as ScheduleEvent[]).map((e) => ({
    ...e,
    venue: e.venue_id ? venueMap.get(e.venue_id) ?? null : null,
    backup_venue: e.backup_venue_id
      ? venueMap.get(e.backup_venue_id) ?? null
      : null,
  }));
  await db.scheduleEvents.clear();
  await db.scheduleEvents.bulkPut(enriched);
  await setLastSyncTime('schedule');
  return enriched;
}

export async function pullAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false });
  if (error) throw error;
  const items = (data ?? []) as Announcement[];
  await db.announcements.clear();
  await db.announcements.bulkPut(items);
  await setLastSyncTime('announcements');
  return items;
}

export async function pullConnections(): Promise<Connection[]> {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const connections = (data ?? []) as Connection[];
  await db.connections.clear();
  await db.connections.bulkPut(connections);
  return connections;
}

export async function pullSettings(): Promise<void> {
  const { data, error } = await supabase.from('event_settings').select('*');
  if (error) throw error;
  for (const row of data ?? []) {
    await db.settings.put({ key: row.key, value: row.value });
  }
  await setLastSyncTime('settings');
}

export async function flushSyncQueue(): Promise<void> {
  const code = getAccessCode();
  if (!code || !navigator.onLine) return;

  const pending = await db.syncQueue
    .where('status')
    .equals('pending')
    .toArray();

  for (const item of pending) {
    try {
      if (item.action === 'request_connection') {
        const { error } = await supabase.rpc('request_connection', {
          p_access_code: code,
          ...item.payload,
        });
        if (error) throw error;
      } else if (item.action === 'respond_connection') {
        const { error } = await supabase.rpc('respond_connection', {
          p_access_code: code,
          ...item.payload,
        });
        if (error) throw error;
      }
      if (item.id) await db.syncQueue.delete(item.id);
    } catch {
      if (item.id) {
        await db.syncQueue.update(item.id, { status: 'failed' });
      }
    }
  }
  await pullConnections();
}

export async function syncWhenOnline(opts?: { skipPull?: boolean }): Promise<void> {
  if (!navigator.onLine) return;
  await flushSyncQueue();
  if (!opts?.skipPull) await pullAllData();
}
