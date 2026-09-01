import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { useThemeStore } from '../src/stores/themeStore';

export default function ModalScreen() {
  const C = useColors();
  const isDark = useThemeStore((s) => s.scheme) === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <Text style={[styles.title, { color: C.text }]}>Modal</Text>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});
