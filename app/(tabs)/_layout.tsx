import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { getThemeColors } from '../../src/constants/colors';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 26 : 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  const { session, initialized } = useAuthStore();
  const { scheme, hydrate: hydrateTheme } = useThemeStore();
  const C = getThemeColors(scheme);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (initialized && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, initialized]);

  useEffect(() => { hydrateTheme(); }, []);

  if (!session) return null;

  // On Android with gesture nav, insets.bottom can be 0 even with gesture bar
  // so we add a small base padding for comfort
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 36 : 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bgCard,
          borderTopColor: C.border,
          borderTopWidth: 0.5,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          paddingTop: 4,
        },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: 'Vocabulary',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="verbs"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="studied"
        options={{
          title: 'Studied',
          tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🧠" focused={focused} />,
        }}
      />
      {/* Hidden screens — no tab bar entry */}
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="audio" options={{ href: null }} />
      <Tabs.Screen name="studybook" options={{ href: null }} />
    </Tabs>
  );
}
