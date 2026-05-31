import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Vocabulary, VocabRow, VocabStatus } from '../types';

// Convert flat DB row → Vocabulary UI type
// id is a composite string so it's globally unique across chapters/sections
export function rowToVocab(row: VocabRow): Vocabulary {
  return {
    id: `${row.chapter}_${row.section}_${row.no}`,
    chapter: row.chapter,
    chapter_name: row.chapter_name,
    section: row.section,
    section_name: row.section_name,
    order_number: row.no,
    word: row.word_kanji,
    reading: row.reading,
    meaning: row.meaning,
    example_jp: row.jp_example,
    example_en: row.en_example,
  };
}

// Parse composite id "chapter_section_no" back to parts
function parseCompositeId(id: string): { chapter: number; section: number; no: number } | null {
  const parts = id.split('_');
  if (parts.length !== 3) return null;
  return {
    chapter: parseInt(parts[0], 10),
    section: parseInt(parts[1], 10),
    no: parseInt(parts[2], 10),
  };
}

interface VocabStatusMap {
  [compositeId: string]: VocabStatus; // key = "chapter_section_no"
}

interface VocabStore {
  statusMap: VocabStatusMap;
  loading: boolean;
  fetchStatuses: (userId: string) => Promise<void>;
  updateStatus: (userId: string, vocabId: string, status: VocabStatus) => Promise<void>;
  getStatus: (vocabId: string) => VocabStatus;
  getCountsByStatus: (vocabs: Vocabulary[]) => { unread: number; studying: number; studied: number };
}

export const useVocabStore = create<VocabStore>((set, get) => ({
  statusMap: {},
  loading: false,

  fetchStatuses: async (userId: string) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('user_vocab_status')
      .select('chapter, section, no, status')
      .eq('user_id', userId);

    if (!error && data) {
      const map: VocabStatusMap = {};
      data.forEach((row: { chapter: number; section: number; no: number; status: VocabStatus }) => {
        map[`${row.chapter}_${row.section}_${row.no}`] = row.status;
      });
      set({ statusMap: map });
    }
    set({ loading: false });
  },

  updateStatus: async (userId: string, vocabId: string, status: VocabStatus) => {
    // Optimistic update in-memory first
    set((state) => ({
      statusMap: { ...state.statusMap, [vocabId]: status },
    }));

    const parsed = parseCompositeId(vocabId);
    if (!parsed) {
      console.error('Invalid vocabId format:', vocabId);
      return;
    }

    const { error } = await supabase.from('user_vocab_status').upsert(
      {
        user_id: userId,
        chapter: parsed.chapter,
        section: parsed.section,
        no: parsed.no,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,chapter,section,no' }
    );

    if (error) {
      console.error('Failed to update vocab status:', error);
    }
  },

  getStatus: (vocabId: string) => {
    return get().statusMap[vocabId] ?? 'unread';
  },

  getCountsByStatus: (vocabs: Vocabulary[]) => {
    const { statusMap } = get();
    return vocabs.reduce(
      (acc, v) => {
        const s = statusMap[v.id] ?? 'unread';
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      },
      { unread: 0, studying: 0, studied: 0 }
    );
  },
}));
