import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { FONTS, SPACING } from '../src/constants/colors';

export default function NotFoundScreen() {
  const C = useColors();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: C.bg }]}>
        <Text style={styles.emoji}>🔍</Text>
        <Text style={[styles.title, { color: C.text }]}>Page Not Found</Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={[styles.linkText, { color: C.primary }]}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: FONTS.sizes.xl, fontWeight: FONTS.weights.bold },
  link: { marginTop: SPACING.md },
  linkText: { fontSize: FONTS.sizes.md },
});
