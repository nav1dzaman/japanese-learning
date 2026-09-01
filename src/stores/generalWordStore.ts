import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { GeneralWord, GeneralWordDraft, GeneralWordStatus } from '../types';

interface GeneralWordStatusMap {
  [wordId: string]: GeneralWordStatus;
}

interface GeneralWordStore {
  words: GeneralWord[];
  statusMap: GeneralWordStatusMap;
  loading: boolean;
  error: string | null;

  fetchWords: (userId?: string) => Promise<void>;
  fetchStatuses: (userId: string) => Promise<void>;
  addWord: (userId: string, draft: GeneralWordDraft) => Promise<GeneralWord | null>;
  batchAddWords: (userId: string, drafts: GeneralWordDraft[]) => Promise<number>;
  updateWord: (wordId: string, updates: Partial<GeneralWord>) => Promise<void>;
  deleteWord: (wordId: string) => Promise<void>;
  updateStatus: (userId: string, wordId: string, status: GeneralWordStatus) => Promise<void>;
  getStatus: (wordId: string) => GeneralWordStatus;
  getCategories: () => string[];
  getStats: () => { total: number; studying: number; studied: number; unread: number };
}

export const useGeneralWordStore = create<GeneralWordStore>((set, get) => ({
  words: [],
  statusMap: {},
  loading: false,
  error: null,

  fetchWords: async (userId?: string) => {
    set({ loading: true, error: null });
    try {
      let query = supabase
        .from('general_words')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.or(`user_id.is.null,user_id.eq.${userId}`);
      }

      const { data, error } = await query;
      if (error) {
        set({ error: error.message, loading: false });
        return;
      }

      set({ words: (data as GeneralWord[]) ?? [], loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchStatuses: async (userId: string) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('user_general_word_status')
        .select('word_id, status')
        .eq('user_id', userId);

      if (!error && data) {
        const map: GeneralWordStatusMap = {};
        data.forEach((row: { word_id: string; status: GeneralWordStatus }) => {
          map[row.word_id] = row.status;
        });
        set({ statusMap: map });
      }
    } catch (err) {
      console.error('Failed to fetch general word statuses:', err);
    }
  },

  addWord: async (userId: string, draft: GeneralWordDraft) => {
    try {
      const payload = {
        user_id: userId,
        word_english: draft.word_english.trim(),
        word_japanese: draft.word_japanese.trim(),
        word_hiragana: draft.word_hiragana.trim(),
        word_romaji: draft.word_romaji.trim(),
        word_type: draft.word_type || 'noun',
        verb_forms: draft.verb_forms || null,
        sentence_english: draft.sentence_english?.trim() || null,
        sentence_japanese: draft.sentence_japanese?.trim() || null,
        category: draft.category?.trim() || 'General',
      };

      const { data, error } = await supabase
        .from('general_words')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      const newWord = data as GeneralWord;
      set((state) => ({
        words: [newWord, ...state.words],
      }));
      return newWord;
    } catch (err: any) {
      console.error('Failed to add general word:', err);
      return null;
    }
  },

  batchAddWords: async (userId: string, drafts: GeneralWordDraft[]) => {
    if (!drafts.length) return 0;
    try {
      const payload = drafts.map((d) => ({
        user_id: userId,
        word_english: d.word_english.trim(),
        word_japanese: d.word_japanese.trim(),
        word_hiragana: d.word_hiragana.trim(),
        word_romaji: d.word_romaji.trim(),
        word_type: d.word_type || 'noun',
        verb_forms: d.verb_forms || null,
        sentence_english: d.sentence_english?.trim() || null,
        sentence_japanese: d.sentence_japanese?.trim() || null,
        category: d.category?.trim() || 'General',
      }));

      const { data, error } = await supabase
        .from('general_words')
        .insert(payload)
        .select();

      if (error) throw error;

      const inserted = (data as GeneralWord[]) ?? [];
      set((state) => ({
        words: [...inserted, ...state.words],
      }));
      return inserted.length;
    } catch (err: any) {
      console.error('Failed to batch add general words:', err);
      return 0;
    }
  },

  updateWord: async (wordId: string, updates: Partial<GeneralWord>) => {
    try {
      set((state) => ({
        words: state.words.map((w) => (w.id === wordId ? { ...w, ...updates } : w)),
      }));

      const { error } = await supabase
        .from('general_words')
        .update(updates)
        .eq('id', wordId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update general word:', err);
    }
  },

  deleteWord: async (wordId: string) => {
    try {
      set((state) => ({
        words: state.words.filter((w) => w.id !== wordId),
      }));

      const { error } = await supabase
        .from('general_words')
        .delete()
        .eq('id', wordId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to delete general word:', err);
    }
  },

  updateStatus: async (userId: string, wordId: string, status: GeneralWordStatus) => {
    // Optimistic local state update
    set((state) => ({
      statusMap: { ...state.statusMap, [wordId]: status },
    }));

    try {
      const { error } = await supabase.from('user_general_word_status').upsert(
        {
          user_id: userId,
          word_id: wordId,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,word_id' }
      );

      if (error) console.error('Failed to update general word status in DB:', error);
    } catch (err) {
      console.error('Error updating general word status:', err);
    }
  },

  getStatus: (wordId: string): GeneralWordStatus => {
    return get().statusMap[wordId] ?? 'unread';
  },

  getCategories: (): string[] => {
    const { words } = get();
    const setCats = new Set<string>();
    words.forEach((w) => {
      if (w.category && w.category.trim()) {
        setCats.add(w.category.trim());
      }
    });
    return Array.from(setCats).sort();
  },

  getStats: () => {
    const { words, statusMap } = get();
    let studying = 0;
    let studied = 0;
    words.forEach((w) => {
      const s = statusMap[w.id];
      if (s === 'studying') studying++;
      else if (s === 'studied') studied++;
    });
    const unread = words.length - studying - studied;
    return { total: words.length, studying, studied, unread };
  },
}));
