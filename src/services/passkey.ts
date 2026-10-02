import { Platform } from 'react-native';

/**
 * Predisposizione passkey (iOS 16+ / Android 9+).
 *
 * Per attivarle davvero servono:
 *  - un backend WebAuthn (challenge di registrazione/autenticazione)
 *  - un dominio con `apple-app-site-association` (iOS, `webcredentials:`) e `assetlinks.json` (Android)
 *  - la libreria `react-native-passkey` (richiede un development build, non funziona in Expo Go)
 */

export function isPasskeySupported(): boolean {
  if (Platform.OS === 'ios') return parseInt(String(Platform.Version), 10) >= 16;
  if (Platform.OS === 'android') return Number(Platform.Version) >= 28;
  return false;
}

/** TODO: chiedere la challenge al backend e chiamare `Passkey.create(...)`. */
export async function registerPasskey(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 900));
}

/** TODO: chiedere la challenge al backend e chiamare `Passkey.get(...)`. */
export async function signInWithPasskey(): Promise<boolean> {
  return false;
}
