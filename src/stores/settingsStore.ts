import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app_settings_v1';

const DEFAULT_INWORLD_KEY = 'OHYtcEhlQlJLckxVTWtWcFdKNkdraWZiekQ2TkxZQXE6SVRVVGQzQWVqbFFfeDgwUVRmYUk4Uw==';

export interface AppSettings {
  // Groq LLM
  groqApiKey: string;
  groqModel: string;
  // Inworld TTS
  inworldApiKey: string;
  inworldModel: string;
  inworldVoice: string;
}

interface SettingsStore extends AppSettings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (partial: Partial<AppSettings>) => Promise<void>;
}

const DEFAULTS: AppSettings = {
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
  inworldApiKey: DEFAULT_INWORLD_KEY,
  inworldModel: 'inworld-tts-2',
  inworldVoice: 'Asuka',
};

export const GROQ_MODELS = [
  { label: 'Llama 3.3 70B (Recommended)', value: 'llama-3.3-70b-versatile' },
  { label: 'Llama 3 8B (Fast)', value: 'llama3-8b-8192' },
  { label: 'Mixtral 8x7B', value: 'mixtral-8x7b-32768' },
];

export const INWORLD_VOICES = [
  'Asuka', 'Hana', 'Kenji', 'Yuki', 'Sora',
];

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: Partial<AppSettings> = JSON.parse(raw);
        set({ ...DEFAULTS, ...saved, hydrated: true });
      } else {
        // First launch — save defaults (pre-populates Inworld key)
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS));
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  update: async (partial) => {
    const current = get();
    const next: AppSettings = {
      groqApiKey: current.groqApiKey,
      groqModel: current.groqModel,
      inworldApiKey: current.inworldApiKey,
      inworldModel: current.inworldModel,
      inworldVoice: current.inworldVoice,
      ...partial,
    };
    set(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  },
}));
