import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View, LogBox } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { useVocabStore } from '../src/stores/vocabStore';
import { useThemeStore } from '../src/stores/themeStore';
import { getThemeColors } from '../src/constants/colors';

// Ignore harmless Expo CLI connection retry warnings in LogBox UI
LogBox.ignoreLogs([
  'Cannot connect to Expo CLI',
  'WebSocket connection',
]);

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { setSession, user, initialized } = useAuthStore();
  const { fetchStatuses } = useVocabStore();
  const { scheme, hydrate: hydrateTheme } = useThemeStore();
  const C = getThemeColors(scheme);
  const isDark = scheme === 'dark';

  const [appReady, setAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { hydrateTheme(); }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchStatuses(session.user.id);
      }
      setAppReady(true);
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

  useEffect(() => {
    if (appReady) {
      // Hide the native splash screen
      SplashScreen.hideAsync();

      // Animate the custom splash out
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.08,
            duration: 700,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setShowCustomSplash(false);
        });
      }, 1800); // Show splash for 1.8s minimum
    }
  }, [appReady]);

  // Redirect based on auth state once initialized
  useEffect(() => {
    if (!initialized || showCustomSplash) return;
    if (user) {
      router.replace('/(tabs)');
    } else {
      router.replace('/(auth)/login');
    }
  }, [initialized, user, showCustomSplash]);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: C.bg,
      card: C.bgCard,
      border: C.border,
      text: C.text,
      primary: C.primary,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>

      {/* Custom animated splash overlay */}
      {showCustomSplash && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
              zIndex: 999,
            },
          ]}
        >
          <Image
            source={require('../assets/images/splash-icon.png')}
            style={styles.splashImage}
            resizeMode="cover"
          />
        </Animated.View>
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
