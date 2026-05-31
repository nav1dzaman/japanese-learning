import { Stack } from 'expo-router';

export default function VocabularyLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0D0D1A' },
      }}
    />
  );
}
