import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/context/auth';
import { BackgroundFocusProvider } from '@/context/background-focus';
import { CardsProvider } from '@/context/cards';
import { ParallaxProvider } from '@/context/parallax';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

function RootStack() {
  const { isSignedIn, isRestoring } = useAuth();
  const t = useTheme();
  // Finché non si sa se c'è una sessione salvata resta visibile lo splash (evita il lampo della schermata di login).
  if (isRestoring) return null;
  return (
    // Tra login e app: stesso scorrimento orizzontale del resto dell'app. Le singole schermate hanno ciascuna il proprio sfondo animato (sincronizzato).
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={isSignedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isSignedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const base = dark ? DarkTheme : DefaultTheme;
  const colors = dark ? Colors.dark : Colors.light;
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: colors.background, primary: colors.primary } }}>
      <AuthProvider>
        <StatusBar style="auto" />
        <ParallaxProvider>
          <BackgroundFocusProvider>
            <CardsProvider>
              <RootStack />
            </CardsProvider>
          </BackgroundFocusProvider>
        </ParallaxProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
