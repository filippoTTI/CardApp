import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function AuthLayout() {
  const t = useTheme();
  // Login ↔ registrazione: scorrimento orizzontale nativo.
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: 'slide_from_right' }} />;
}
