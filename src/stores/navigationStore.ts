import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'last_visited_location';

export interface LastLocation {
  type: 'section';
  chapterId: number;
  chapterName: string;
  sectionId: number;
  sectionName: string;
  visitedAt: string; // ISO string
}

interface NavigationStore {
  lastLocation: LastLocation | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  saveLocation: (loc: Omit<LastLocation, 'visitedAt'>) => Promise<void>;
  clearLocation: () => Promise<void>;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  lastLocation: null,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: LastLocation = JSON.parse(raw);
        set({ lastLocation: parsed, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  saveLocation: async (loc) => {
    const full: LastLocation = { ...loc, visitedAt: new Date().toISOString() };
    set({ lastLocation: full });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(full));
    } catch {
      // silently ignore storage errors
    }
  },

  clearLocation: async () => {
    set({ lastLocation: null });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  },
}));
