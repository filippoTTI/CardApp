import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function AppLayout() {
  const t = useTheme();
  // Home ↔ profilo: scorrimento orizzontale.
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="card-details" />
      <Stack.Screen name="add-account" />
      <Stack.Screen name="pin-setup" />
      <Stack.Screen name="delete-account" />
    </Stack>
  );
}
