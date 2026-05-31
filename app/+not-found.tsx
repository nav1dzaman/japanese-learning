import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONTS, SPACING } from '../src/constants/colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.emoji}>🔍</Text>
        <Text style={styles.title}>Page Not Found</Text>
        <Link href="/(tabs)" style={styles.link}>
          <Text style={styles.linkText}>Go to home screen</Text>
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
    backgroundColor: COLORS.bg,
    gap: SPACING.lg,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: FONTS.sizes.xl, color: COLORS.text, fontWeight: FONTS.weights.bold },
  link: { marginTop: SPACING.md },
  linkText: { color: COLORS.primary, fontSize: FONTS.sizes.md },
});
