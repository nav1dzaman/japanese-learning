import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorScheme = 'dark' | 'light';

interface ThemeStore {
  scheme: ColorScheme;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setScheme: (s: ColorScheme) => Promise<void>;
  toggle: () => Promise<void>;
}

const KEY = 'app_theme_v1';

export const useThemeStore = create<ThemeStore>((set, get) => ({
  scheme: 'dark',
  hydrated: false,

  hydrate: async () => {
    try {
      const saved = await AsyncStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') {
        set({ scheme: saved, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  setScheme: async (s) => {
    set({ scheme: s });
    try { await AsyncStorage.setItem(KEY, s); } catch {}
  },

  toggle: async () => {
    const next: ColorScheme = get().scheme === 'dark' ? 'light' : 'dark';
    set({ scheme: next });
    try { await AsyncStorage.setItem(KEY, next); } catch {}
  },
}));
