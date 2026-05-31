import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: false,
  initialized: false,

  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      initialized: true,
    });
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    set({ loading: false });
    if (error) return { error: error.message };
    if (!data.session) return { error: 'Sign in failed. Please try again.' };
    return { error: null };
  },

  signUp: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Skip email confirmation — user is signed in immediately
        data: {},
      },
    });
    set({ loading: false });
    if (error) return { error: error.message };
    // If email confirmation is enabled in Supabase dashboard,
    // session will be null here. Auto-confirm must be ON in Supabase Auth settings.
    if (!data.session) {
      return { error: 'Please check your email to confirm your account before signing in.' };
    }
    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));

