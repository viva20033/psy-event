import { supabase, getAccessCode } from '@/lib/supabase/client';
import { db, setLastSyncTime } from '@/lib/offline/db';
import { useSession } from '@/stores/session';
import type {
  Announcement,
  Connection,
  EventDay,
  IntensiveTrainer,
  ScheduleEvent,
  Venue,
} from '@/types';

const MIN_SYNC_OVERLAY_MS = 450;

/** Обновить таблицу без clear() — иначе список на экране на мгновение пустеет и «дёргается». */
type IdRow = { id: string };

type SyncableTable = {
  bulkPut: (items: IdRow[]) => Promise<unknown>;
  toCollection: () => { primaryKeys: () => Promise<Array<string | number>> };
  bulkDelete: (keys: Array<string | number>) => Promise<unknown>;
  clear: () => Promise<void>;
};

function asSyncTable(table: unknown): SyncableTable {
  return table as SyncableTable;
}

async function replaceTableRows(table: unknown, items: IdRow[]): Promise<void> {
  const t = asSyncTable(table);
  if (items.length > 0) {
    await t.bulkPut(items);
  }
  const keep = new Set(items.map((i) => i.id));
  const existing = await t.toCollection().primaryKeys();
  const toDelete = existing.filter((id) => !keep.has(String(id)));
  if (toDelete.length > 0) {
    await t.bulkDelete(toDelete);
  } else if (items.length === 0) {
    await t.clear();
  }
}

export async function pullAllData(): Promise<void> {
  const { setDataSyncing } = useSession.getState();
  const started = Date.now();
  setDataSyncing(true);
  try {
    const [venues, trainers, days, events, announcements, connections] = await Promise.all([
      fetchVenues(),
      fetchTrainers(),
      fetchEventDays(),
      fetchScheduleEvents(),
      fetchAnnouncements(),
      fetchConnections(),
    ]);

    await db.transaction(
      'rw',
      [
        db.venues,
        db.intensiveTrainers,
        db.eventDays,
        db.scheduleEvents,
        db.announcements,
        db.connections,
      ],
      async () => {
        await replaceTableRows(db.venues, venues);
        await replaceTableRows(db.intensiveTrainers, trainers);
        await replaceTableRows(db.eventDays, days);
        await replaceTableRows(db.scheduleEvents, events);
        await replaceTableRows(db.announcements, announcements);
        await replaceTableRows(db.connections, connections);
      },
    );

    await Promise.all([
      setLastSyncTime('venues'),
      setLastSyncTime('intensiveTrainers'),
      setLastSyncTime('eventDays'),
      setLastSyncTime('schedule'),
      setLastSyncTime('announcements'),
    ]);
    await pullSettings();
  } finally {
    const elapsed = Date.now() - started;
    const wait = MIN_SYNC_OVERLAY_MS - elapsed;
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait));
    }
    useSession.getState().setDataSyncing(false);
  }
}

async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as Venue[];
}

async function fetchTrainers(): Promise<IntensiveTrainer[]> {
  const { data, error } = await supabase
    .from('intensive_trainers')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order')
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as IntensiveTrainer[];
}

async function fetchEventDays(): Promise<EventDay[]> {
  const { data, error } = await supabase.from('event_days').select('*').order('day_index');
  if (error) throw error;
  return (data ?? []) as EventDay[];
}

async function fetchScheduleEvents(): Promise<ScheduleEvent[]> {
  const { data: events, error } = await supabase
    .from('schedule_events')
    .select('*')
    .order('starts_at');
  if (error) throw error;
  const { data: venues } = await supabase.from('venues').select('*');
  const venueMap = new Map((venues ?? []).map((v) => [v.id, v]));
  return ((events ?? []) as ScheduleEvent[]).map((e) => ({
    ...e,
    venue: e.venue_id ? venueMap.get(e.venue_id) ?? null : null,
    backup_venue: e.backup_venue_id ? venueMap.get(e.backup_venue_id) ?? null : null,
  }));
}

async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_published', true)
    .order('published_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Announcement[];
}

async function fetchConnections(): Promise<Connection[]> {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Connection[];
}

export async function pullVenues(): Promise<Venue[]> {
  const venues = await fetchVenues();
  await replaceTableRows(db.venues, venues);
  await setLastSyncTime('venues');
  return venues;
}

export async function pullIntensiveTrainers(): Promise<IntensiveTrainer[]> {
  const trainers = await fetchTrainers();
  await replaceTableRows(db.intensiveTrainers, trainers);
  await setLastSyncTime('intensiveTrainers');
  return trainers;
}

export async function pullEventDays(): Promise<EventDay[]> {
  const days = await fetchEventDays();
  await replaceTableRows(db.eventDays, days);
  await setLastSyncTime('eventDays');
  return days;
}

export async function pullSchedule(): Promise<ScheduleEvent[]> {
  const enriched = await fetchScheduleEvents();
  await replaceTableRows(db.scheduleEvents, enriched);
  await setLastSyncTime('schedule');
  return enriched;
}

export async function pullAnnouncements(): Promise<Announcement[]> {
  const items = await fetchAnnouncements();
  await replaceTableRows(db.announcements, items);
  await setLastSyncTime('announcements');
  return items;
}

export async function pullConnections(): Promise<Connection[]> {
  const connections = await fetchConnections();
  await replaceTableRows(db.connections, connections);
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
