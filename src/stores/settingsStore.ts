import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app_settings_v1';

const DEFAULT_INWORLD_KEY = 'OHYtcEhlQlJLckxVTWtWcFdKNkdraWZiekQ2TkxZQXE6SVRVVGQzQWVqbFFfeDgwUVRmYUk4Uw==';

export interface AppSettings {
  // Groq LLM
  groqApiKey: string;
  groqModel: string;
  // Google Gemini AI
  geminiApiKey: string;
  geminiModel: string;
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
  geminiApiKey: '',
  geminiModel: 'gemini-3.6-flash',
  inworldApiKey: DEFAULT_INWORLD_KEY,
  inworldModel: 'inworld-tts-2',
  inworldVoice: 'Asuka',
};

export const GROQ_MODELS = [
  { label: 'Llama 3.3 70B (Versatile - Recommended)', value: 'llama-3.3-70b-versatile' },
  { label: 'Llama 3.1 8B (Instant - High Speed)', value: 'llama-3.1-8b-instant' },
  { label: 'DeepSeek R1 Distill Llama 70B (Reasoning)', value: 'deepseek-r1-distill-llama-70b' },
  { label: 'Llama 3.2 11B (Vision Preview)', value: 'llama-3.2-11b-vision-preview' },
  { label: 'Llama 3.2 3B (Compact Preview)', value: 'llama-3.2-3b-preview' },
  { label: 'Llama 3.2 1B (Lightweight Preview)', value: 'llama-3.2-1b-preview' },
];

export const GEMINI_MODELS = [
  { label: 'Gemini 3.6 Flash (Recommended)', value: 'gemini-3.6-flash' },
  { label: 'Gemini 3.6 Pro (Deep Reasoning)', value: 'gemini-3.6-pro' },
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash' },
  { label: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro' },
];

export const INWORLD_VOICES = [
  'Asuka', 'Hana', 'Kenji', 'Yuki', 'Sora',
];

const DEPRECATED_GROQ_MODELS = new Set([
  'gemma2-9b-it',
  'mixtral-8x7b-32768',
  'llama3-8b-8192',
  'llama3-70b-8192',
  'llama-3.1-70b-versatile',
]);

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved: Partial<AppSettings> = JSON.parse(raw);
        // Auto-migrate decommissioned Groq models
        if (!saved.groqModel || DEPRECATED_GROQ_MODELS.has(saved.groqModel)) {
          saved.groqModel = 'llama-3.3-70b-versatile';
        }
        // Auto-migrate Gemini models
        if (!saved.geminiModel || saved.geminiModel === 'gemini-2.5-flash') {
          saved.geminiModel = 'gemini-3.6-flash';
        }
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
      geminiApiKey: current.geminiApiKey,
      geminiModel: current.geminiModel,
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
