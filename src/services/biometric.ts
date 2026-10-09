import * as SecureStore from 'expo-secure-store';

/**
 * Sblocco biometrico (Face ID / impronta) dell'app, in alternativa al codice. Si offre solo se il codice è attivo e il telefono
 * ha la biometria configurata. Il modulo nativo si carica "morbido": finché il dev client non è ricompilato con
 * expo-local-authentication la biometria risulta semplicemente non disponibile, senza errori.
 */

type LocalAuth = typeof import('expo-local-authentication');

let cachedModule: LocalAuth | null | undefined;

function load(): LocalAuth | null {
  if (cachedModule === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      cachedModule = require('expo-local-authentication') as LocalAuth;
    } catch {
      cachedModule = null;
    }
  }
  return cachedModule;
}

const PREF_KEY = 'cardapp.biometric';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

/** Il telefono ha un sensore biometrico con almeno un volto/impronta registrato. */
export async function isBiometricAvailable(): Promise<boolean> {
  const la = load();
  if (!la) return false;
  try {
    return (await la.hasHardwareAsync()) && (await la.isEnrolledAsync());
  } catch {
    return false;
  }
}

/** Scelta dell'utente: attiva di default, si può disattivare dal profilo. */
export async function isBiometricPreferred(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PREF_KEY, OPTIONS)) !== '0';
  } catch {
    return true;
  }
}

export async function setBiometricPreferred(value: boolean): Promise<void> {
  await SecureStore.setItemAsync(PREF_KEY, value ? '1' : '0', OPTIONS);
}

/** Chiede la biometria; true solo se riconosciuta (annullo, errore o assenza di biometria danno false: si ricade sul codice). */
export async function authenticateBiometric(prompt = "Sblocca l'app"): Promise<boolean> {
  const la = load();
  if (!la) return false;
  try {
    const res = await la.authenticateAsync({ promptMessage: prompt, cancelLabel: 'Usa il codice', disableDeviceFallback: true });
    return res.success;
  } catch {
    return false;
  }
}
