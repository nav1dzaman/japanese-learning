import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { VerbStatus } from '../types';

interface VerbStatusMap {
  [verbId: string]: VerbStatus; // key = verb id (number as string)
}

interface VerbStore {
  statusMap: VerbStatusMap;
  loading: boolean;
  fetchStatuses: (userId: string) => Promise<void>;
  updateStatus: (userId: string, verbId: number, status: VerbStatus) => Promise<void>;
  getStatus: (verbId: number) => VerbStatus;
}

export const useVerbStore = create<VerbStore>((set, get) => ({
  statusMap: {},
  loading: false,

  fetchStatuses: async (userId: string) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('user_verb_status')
      .select('verb_id, status')
      .eq('user_id', userId);

    if (!error && data) {
      const map: VerbStatusMap = {};
      data.forEach((row: { verb_id: number; status: VerbStatus }) => {
        map[String(row.verb_id)] = row.status;
      });
      set({ statusMap: map });
    }
    set({ loading: false });
  },

  updateStatus: async (userId: string, verbId: number, status: VerbStatus) => {
    // Optimistic update
    set((state) => ({
      statusMap: { ...state.statusMap, [String(verbId)]: status },
    }));

    const { error } = await supabase.from('user_verb_status').upsert(
      {
        user_id: userId,
        verb_id: verbId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,verb_id' }
    );

    if (error) {
      console.error('Failed to update verb status:', error);
    }
  },

  getStatus: (verbId: number): VerbStatus => {
    return get().statusMap[String(verbId)] ?? 'unread';
  },
}));
