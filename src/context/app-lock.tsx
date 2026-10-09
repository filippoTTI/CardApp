import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/services/api';
import {
  addRecoveryFailure,
  clearPin,
  clearRecoveryFailures,
  isPinSet,
  MAX_RECOVERY_FAILURES,
  setPin as storePin,
  verifyPin,
  type VerifyResult,
} from '@/services/app-lock';
import { resetLocalAccounts, verifyAccountPassword } from '@/services/auth';
import { authenticateBiometric, isBiometricAvailable, isBiometricPreferred, setBiometricPreferred } from '@/services/biometric';

/** Dopo quanto tempo in secondo piano l'app torna a chiedere il codice. */
const LOCK_AFTER_MS = 30 * 1000;

/**
 * Esito del recupero con la password di un account: `ok` codice rimosso e app sbloccata, `wrong` password errata,
 * `reset` troppi errori (app reimpostata: account rimossi dal telefono, il chiamante deve anche chiudere la sessione),
 * `error` impossibile verificare (rete, troppe richieste): non conta come errore.
 */
export type RecoverResult = { status: 'ok' } | { status: 'wrong'; attemptsLeft: number } | { status: 'reset' } | { status: 'error'; message: string };

type AppLockValue = {
  /** True quando si sa se il codice è attivo (all'avvio si legge dall'archivio sicuro). */
  ready: boolean;
  /** Il codice di sblocco è attivo. */
  enabled: boolean;
  /** L'app è bloccata: va mostrata la schermata del codice. */
  locked: boolean;
  /** Il telefono ha la biometria configurata. */
  biometricAvailable: boolean;
  /** Lo sblocco biometrico è in uso (codice attivo, biometria disponibile e scelta dall'utente). */
  biometricEnabled: boolean;
  /** Controlla il codice; se giusto e l'app era bloccata la sblocca. */
  unlock: (pin: string) => Promise<VerifyResult>;
  /** Chiede la biometria e, se riconosciuta, sblocca. */
  unlockWithBiometric: () => Promise<boolean>;
  /** Controlla il codice senza sbloccare (per cambiarlo o disattivarlo). */
  verify: (pin: string) => Promise<VerifyResult>;
  /** Attiva o cambia il codice. */
  setPin: (pin: string) => Promise<void>;
  /** Disattiva il codice. */
  disable: () => Promise<void>;
  /** Attiva o disattiva lo sblocco biometrico (all'attivazione chiede la biometria per conferma). */
  setBiometricEnabled: (value: boolean) => Promise<boolean>;
  /** Codice dimenticato: password di un account salvato; dopo 3 errori consecutivi gli account vengono rimossi dal telefono. */
  recover: (accountKey: string, password: string) => Promise<RecoverResult>;
};

const AppLockContext = createContext<AppLockValue | null>(null);

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricPreferred, setBiometricPreferredState] = useState(true);
  const backgroundAt = useRef<number | null>(null);

  // All'avvio, se il codice è attivo, l'app parte bloccata.
  useEffect(() => {
    let active = true;
    Promise.all([isPinSet(), isBiometricAvailable(), isBiometricPreferred()]).then(([set, available, preferred]) => {
      if (!active) return;
      setEnabled(set);
      setLocked(set);
      setBiometricAvailable(available);
      setBiometricPreferredState(preferred);
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Tornando dal secondo piano dopo un po', l'app si riblocca. (I dialoghi di sistema mettono l'app solo in "inactive", non la bloccano.)
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundAt.current = Date.now();
      } else if (state === 'active') {
        const at = backgroundAt.current;
        backgroundAt.current = null;
        if (at !== null && Date.now() - at >= LOCK_AFTER_MS) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const verify = useCallback((pin: string) => verifyPin(pin), []);

  const unlock = useCallback(async (pin: string) => {
    const res = await verifyPin(pin);
    if (res.ok) {
      void clearRecoveryFailures();
      setLocked(false);
    }
    return res;
  }, []);

  const unlockWithBiometric = useCallback(async () => {
    const ok = await authenticateBiometric("Sblocca l'app");
    if (ok) setLocked(false);
    return ok;
  }, []);

  const setPin = useCallback(async (pin: string) => {
    await storePin(pin);
    await clearRecoveryFailures();
    setEnabled(true);
  }, []);

  const disable = useCallback(async () => {
    await clearPin();
    await clearRecoveryFailures();
    setEnabled(false);
    setLocked(false);
  }, []);

  const setBiometricEnabled = useCallback(async (value: boolean) => {
    if (value && !(await authenticateBiometric('Conferma per attivare lo sblocco biometrico'))) return false;
    await setBiometricPreferred(value);
    setBiometricPreferredState(value);
    return true;
  }, []);

  const recover = useCallback(
    async (accountKey: string, password: string): Promise<RecoverResult> => {
      try {
        await verifyAccountPassword(accountKey, password);
      } catch (e) {
        // rete assente o troppe richieste: non è un verdetto sulla password
        if (e instanceof ApiError && (e.cod === -1 || e.cod === 429)) return { status: 'error', message: e.message };
        const failures = await addRecoveryFailure();
        if (failures >= MAX_RECOVERY_FAILURES) {
          await resetLocalAccounts();
          await disable();
          return { status: 'reset' };
        }
        return { status: 'wrong', attemptsLeft: MAX_RECOVERY_FAILURES - failures };
      }
      await disable();
      return { status: 'ok' };
    },
    [disable],
  );

  const biometricEnabled = enabled && biometricAvailable && biometricPreferred;

  const value = useMemo(
    () => ({ ready, enabled, locked, biometricAvailable, biometricEnabled, unlock, unlockWithBiometric, verify, setPin, disable, setBiometricEnabled, recover }),
    [ready, enabled, locked, biometricAvailable, biometricEnabled, unlock, unlockWithBiometric, verify, setPin, disable, setBiometricEnabled, recover],
  );
  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock deve essere usato dentro AppLockProvider');
  return ctx;
}
