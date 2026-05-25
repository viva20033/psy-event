import { useLiveQuery } from 'dexie-react-hooks';
import { db, getCachedSettings } from '@/lib/offline/db';
import { useEffect, useState } from 'react';
import type { EventSettings } from '@/types';

export function useOfflineData() {
  const profile = useLiveQuery(() => db.profile.toCollection().first());
  const venues = useLiveQuery(() => db.venues.orderBy('sort_order').toArray(), []);
  const eventDays = useLiveQuery(() => db.eventDays.orderBy('day_index').toArray(), []);
  const scheduleEvents = useLiveQuery(
    () => db.scheduleEvents.orderBy('starts_at').toArray(),
    [],
  );
  const announcements = useLiveQuery(
    () => db.announcements.orderBy('published_at').reverse().toArray(),
    [],
  );
  const connections = useLiveQuery(() => db.connections.toArray(), []);
  const [settings, setSettings] = useState<EventSettings>({
    rain_mode: false,
    organizer_contact: '+7 (XXX) XXX-XX-XX',
  });

  useEffect(() => {
    getCachedSettings().then(setSettings);
  }, [announcements, scheduleEvents]);

  return {
    profile,
    venues: venues ?? [],
    eventDays: eventDays ?? [],
    scheduleEvents: scheduleEvents ?? [],
    announcements: announcements ?? [],
    connections: connections ?? [],
    settings,
  };
}
