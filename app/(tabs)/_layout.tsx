import { Tabs, router } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { getThemeColors, type ThemeColors } from '../../src/constants/colors';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 24 : 20, opacity: focused ? 1 : 0.55 }}>
      {emoji}
    </Text>
  );
}

function CenterPopTabButton({
  onPress,
  accessibilityState,
  C,
}: {
  onPress?: any;
  accessibilityState?: any;
  C: ThemeColors;
}) {
  const focused = !!accessibilityState?.selected;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={styles.popButtonWrap}
    >
      <View
        style={[
          styles.popCircle,
          {
            backgroundColor: focused ? '#7C6AF7' : C.bgCard,
            borderColor: focused ? '#C4B5FD' : C.primary,
          },
        ]}
      >
        <Text style={styles.popEmoji}>✨</Text>
      </View>
      <Text
        style={[
          styles.popLabel,
          { color: focused ? C.primaryLight : C.textMuted },
        ]}
      >
        AI Studio
      </Text>
    </TouchableOpacity>
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

  useEffect(() => {
    hydrateTheme();
  }, []);

  if (!session) return null;

  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 32 : 10);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bgCard,
          borderTopColor: C.border,
          borderTopWidth: 0.8,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
          elevation: 8,
          overflow: 'visible',
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      {/* 1. Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />

      {/* 2. Vocabulary */}
      <Tabs.Screen
        name="vocabulary"
        options={{
          title: 'Vocab',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📚" focused={focused} />,
        }}
      />

      {/* 3. Center Popped Up AI Studio Button */}
      <Tabs.Screen
        name="general-words"
        options={{
          title: 'AI Studio',
          tabBarButton: (props) => <CenterPopTabButton {...props} C={C} />,
        }}
      />

      {/* 4. Quiz */}
      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🧠" focused={focused} />,
        }}
      />

      {/* 5. Studied Vault */}
      <Tabs.Screen
        name="studied"
        options={{
          title: 'Studied',
          tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} />,
        }}
      />

      {/* Hidden auxiliary routes */}
      <Tabs.Screen name="verbs" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="audio" options={{ href: null }} />
      <Tabs.Screen name="studybook" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  popButtonWrap: {
    top: -16,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  popCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C6AF7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  popEmoji: {
    fontSize: 24,
  },
  popLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
});
