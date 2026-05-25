import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type {
  Announcement,
  EventDay,
  Group,
  Profile,
  Venue,
} from '@/types';

type LoadKey = 'profiles' | 'eventDays' | 'venues' | 'groups' | 'announcements';

interface AdminDataState {
  profiles: Profile[];
  eventDays: EventDay[];
  venues: Venue[];
  groups: Group[];
  announcements: Announcement[];
  loaded: Partial<Record<LoadKey, boolean>>;
  loading: Partial<Record<LoadKey, boolean>>;

  ensureProfiles: (force?: boolean) => Promise<void>;
  ensureEventDays: (force?: boolean) => Promise<void>;
  ensureVenues: (force?: boolean) => Promise<void>;
  ensureGroups: (force?: boolean) => Promise<void>;
  ensureAnnouncements: (force?: boolean) => Promise<void>;
  prefetchCommon: () => Promise<void>;

  setProfiles: (profiles: Profile[]) => void;
  upsertProfile: (profile: Profile) => void;
  removeProfileLocal: (id: string) => void;
  patchProfile: (id: string, patch: Partial<Profile>) => void;
  setEventDays: (days: EventDay[]) => void;
  patchEventDay: (id: string, patch: Partial<EventDay>) => void;
  setVenues: (venues: Venue[]) => void;
  patchVenue: (id: string, patch: Partial<Venue>) => void;
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const result = await fn();
  if (import.meta.env.DEV) {
    console.debug(`[admin] ${label}: ${Math.round(performance.now() - t0)}ms`);
  }
  return result;
}

export const useAdminData = create<AdminDataState>((set, get) => ({
  profiles: [],
  eventDays: [],
  venues: [],
  groups: [],
  announcements: [],
  loaded: {},
  loading: {},

  async ensureProfiles(force) {
    if (!force && get().loaded.profiles) return;
    if (get().loading.profiles) return;
    set((s) => ({ loading: { ...s.loading, profiles: true } }));
    try {
      const data = await timed('profiles', async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, role, access_code, is_active')
          .order('full_name');
        if (error) throw error;
        return (data ?? []) as Profile[];
      });
      set((s) => ({
        profiles: data,
        loaded: { ...s.loaded, profiles: true },
      }));
    } finally {
      set((s) => ({ loading: { ...s.loading, profiles: false } }));
    }
  },

  async ensureEventDays(force) {
    if (!force && get().loaded.eventDays) return;
    if (get().loading.eventDays) return;
    set((s) => ({ loading: { ...s.loading, eventDays: true } }));
    try {
      const data = await timed('eventDays', async () => {
        const { data, error } = await supabase
          .from('event_days')
          .select('id, day_index, label, event_date, is_rest_day')
          .order('day_index');
        if (error) throw error;
        return (data ?? []) as EventDay[];
      });
      set((s) => ({
        eventDays: data,
        loaded: { ...s.loaded, eventDays: true },
      }));
    } finally {
      set((s) => ({ loading: { ...s.loading, eventDays: false } }));
    }
  },

  async ensureVenues(force) {
    if (!force && get().loaded.venues) return;
    if (get().loading.venues) return;
    set((s) => ({ loading: { ...s.loading, venues: true } }));
    try {
      const { data, error } = await supabase
        .from('venues')
        .select('id, slug, name, description, landmark, route_hint, photo_url, sort_order, is_active')
        .order('sort_order');
      if (error) throw error;
      set((s) => ({
        venues: (data ?? []) as Venue[],
        loaded: { ...s.loaded, venues: true },
      }));
    } finally {
      set((s) => ({ loading: { ...s.loading, venues: false } }));
    }
  },

  async ensureGroups(force) {
    if (!force && get().loaded.groups) return;
    if (get().loading.groups) return;
    set((s) => ({ loading: { ...s.loading, groups: true } }));
    try {
      const { data, error } = await supabase.from('groups').select('*').order('name');
      if (error) throw error;
      set((s) => ({
        groups: (data ?? []) as Group[],
        loaded: { ...s.loaded, groups: true },
      }));
    } finally {
      set((s) => ({ loading: { ...s.loading, groups: false } }));
    }
  },

  async ensureAnnouncements(force) {
    if (!force && get().loaded.announcements) return;
    if (get().loading.announcements) return;
    set((s) => ({ loading: { ...s.loading, announcements: true } }));
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('published_at', { ascending: false });
      if (error) throw error;
      set((s) => ({
        announcements: (data ?? []) as Announcement[],
        loaded: { ...s.loaded, announcements: true },
      }));
    } finally {
      set((s) => ({ loading: { ...s.loading, announcements: false } }));
    }
  },

  async prefetchCommon() {
    await Promise.all([
      get().ensureProfiles(),
      get().ensureEventDays(),
    ]);
  },

  setProfiles: (profiles) => set({ profiles, loaded: { ...get().loaded, profiles: true } }),
  upsertProfile: (profile) =>
    set((s) => {
      const exists = s.profiles.some((p) => p.id === profile.id);
      const profiles = exists
        ? s.profiles.map((p) => (p.id === profile.id ? { ...p, ...profile } : p))
        : [...s.profiles, profile].sort((a, b) => a.full_name.localeCompare(b.full_name));
      return { profiles };
    }),
  removeProfileLocal: (id) =>
    set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) })),
  patchProfile: (id, patch) =>
    set((s) => ({
      profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  setEventDays: (eventDays) => set({ eventDays, loaded: { ...get().loaded, eventDays: true } }),
  patchEventDay: (id, patch) =>
    set((s) => ({
      eventDays: s.eventDays.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),
  setVenues: (venues) => set({ venues, loaded: { ...get().loaded, venues: true } }),
  patchVenue: (id, patch) =>
    set((s) => ({
      venues: s.venues.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    })),
}));
