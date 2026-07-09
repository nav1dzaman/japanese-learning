import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from '../src/lib/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { useVocabStore } from '../src/stores/vocabStore';

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { setSession, user, initialized } = useAuthStore();
  const { fetchStatuses } = useVocabStore();

  const [appReady, setAppReady] = useState(false);
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

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

      {/* Custom animated splash overlay */}
      {showCustomSplash && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
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
