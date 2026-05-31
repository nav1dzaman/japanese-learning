import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { useVocabStore } from '../src/stores/vocabStore';

export default function RootLayout() {
  const { setSession, user, initialized } = useAuthStore();
  const { fetchStatuses } = useVocabStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchStatuses(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchStatuses(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect based on auth state once initialized
  useEffect(() => {
    if (!initialized) return;
    if (user) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [initialized, user]);

  const customDark = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0D0D1A',
      card: '#16162A',
      border: 'rgba(255,255,255,0.08)',
      text: '#F0EEF8',
      primary: '#7C6AF7',
    },
  };

  return (
    <ThemeProvider value={customDark}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}

