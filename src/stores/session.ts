import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile } from '@/types';
import { setAccessCode } from '@/lib/supabase/client';
import { db } from '@/lib/offline/db';

const STORAGE_KEY = 'psy-event-session';

interface SessionState {
  profile: Profile | null;
  isHydrated: boolean;
  pendingSync: boolean;
  setProfile: (profile: Profile) => Promise<void>;
  clearSession: () => Promise<void>;
  setPendingSync: (v: boolean) => void;
  hydrate: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      profile: null,
      isHydrated: false,
      pendingSync: false,
      setProfile: async (profile) => {
        setAccessCode(profile.access_code);
        await db.profile.put(profile);
        set({ profile, pendingSync: false });
      },
      clearSession: async () => {
        setAccessCode(null);
        await db.profile.clear();
        set({ profile: null, pendingSync: false });
      },
      setPendingSync: (pendingSync) => set({ pendingSync }),
      hydrate: () => set({ isHydrated: true }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (s) => ({ profile: s.profile }),
      onRehydrateStorage: () => (state) => {
        if (state?.profile) setAccessCode(state.profile.access_code);
        state?.hydrate();
      },
    },
  ),
);
