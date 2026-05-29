import Dexie, { type EntityTable } from 'dexie';
import type {
  Announcement,
  Connection,
  EventDay,
  EventSettings,
  IntensiveTrainer,
  Profile,
  ScheduleEvent,
  SyncQueueItem,
  Venue,
} from '@/types';

export interface CachedMeta {
  key: string;
  updatedAt: number;
}

class OfflineDatabase extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  venues!: EntityTable<Venue, 'id'>;
  intensiveTrainers!: EntityTable<IntensiveTrainer, 'id'>;
  eventDays!: EntityTable<EventDay, 'id'>;
  scheduleEvents!: EntityTable<ScheduleEvent, 'id'>;
  announcements!: EntityTable<Announcement, 'id'>;
  connections!: EntityTable<Connection, 'id'>;
  settings!: EntityTable<{ key: string; value: unknown }, 'key'>;
  syncQueue!: EntityTable<SyncQueueItem, 'id'>;
  meta!: EntityTable<CachedMeta, 'key'>;

  constructor() {
    super('psy-event-offline');
    this.version(1).stores({
      profile: 'id',
      venues: 'id, slug, sort_order',
      eventDays: 'id, day_index',
      scheduleEvents: 'id, event_day_id, starts_at',
      announcements: 'id, published_at',
      connections: 'id, requester_id, target_profile_id, status',
      settings: 'key',
      syncQueue: '++id, status, createdAt',
      meta: 'key',
    });
    this.version(2).stores({
      profile: 'id',
      venues: 'id, slug, sort_order',
      intensiveTrainers: 'id, profile_id, sort_order',
      eventDays: 'id, day_index',
      scheduleEvents: 'id, event_day_id, starts_at',
      announcements: 'id, published_at',
      connections: 'id, requester_id, target_profile_id, status',
      settings: 'key',
      syncQueue: '++id, status, createdAt',
      meta: 'key',
    });
  }
}

export const db = new OfflineDatabase();

export async function getCachedSettings(): Promise<EventSettings> {
  const rain = await db.settings.get('rain_mode');
  const contact = await db.settings.get('organizer_contact');
  return {
    rain_mode: rain?.value === true || rain?.value === 'true' || false,
    organizer_contact:
      (contact?.value as string) || '+7 (XXX) XXX-XX-XX',
  };
}

export async function getLastSyncTime(key: string): Promise<number | null> {
  const meta = await db.meta.get(key);
  return meta?.updatedAt ?? null;
}

export async function setLastSyncTime(key: string): Promise<void> {
  await db.meta.put({ key, updatedAt: Date.now() });
}
