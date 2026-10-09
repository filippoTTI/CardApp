import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { LockScreen } from '@/components/ui/lock-screen';
import { PrivacyCover } from '@/components/ui/privacy-cover';
import { AppLockProvider, useAppLock } from '@/context/app-lock';
import { AuthProvider, useAuth } from '@/context/auth';
import { BackgroundFocusProvider } from '@/context/background-focus';
import { CardsProvider } from '@/context/cards';
import { ParallaxProvider } from '@/context/parallax';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

function RootStack() {
  const { isSignedIn, isRestoring } = useAuth();
  const { ready: lockReady, locked, covered } = useAppLock();
  const t = useTheme();
  // Finché non si sa se c'è una sessione salvata resta visibile lo splash (evita il lampo della schermata di login).
  // Idem finché non si sa se l'app è protetta da un codice: niente lampo di contenuto prima della schermata di blocco.
  if (isRestoring || !lockReady) return null;
  return (
    <View style={{ flex: 1 }}>
      {/* Tra login e app: stesso scorrimento orizzontale del resto dell'app. Le singole schermate hanno ciascuna il proprio sfondo animato (sincronizzato). */}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.background }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={isSignedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      {/* Con il codice attivo copre tutto (anche il login) finché non viene inserito. */}
      {locked && <LockScreen />}
      {/* App fuori dal primo piano: copre anche la schermata del codice, così l'anteprima del multitasking mostra solo il logo. */}
      {covered && <PrivacyCover />}
    </View>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const base = dark ? DarkTheme : DefaultTheme;
  const colors = dark ? Colors.dark : Colors.light;
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: colors.background, primary: colors.primary } }}>
      <AppLockProvider>
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
      </AppLockProvider>
    </ThemeProvider>
  );
}
