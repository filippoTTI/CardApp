import * as SecureStore from 'expo-secure-store';

import { sha256Hex } from '@/services/sha256';

/**
 * Codice di sblocco dell'app (4 cifre), valido a prescindere dall'account. Resta solo sul dispositivo, nell'archivio sicuro
 * (Keychain / Keystore, non incluso nei backup né trasferito su altri dispositivi): non viene mai inviato a nessun server.
 * Si salva solo un hash con sale, mai il codice. Dopo troppi errori i tentativi si bloccano per un tempo crescente.
 */

export const PIN_LENGTH = 4;

const STORE_KEY = 'cardapp.pin';
const HASH_ROUNDS = 1000;
/** Tentativi sbagliati consentiti prima del primo blocco. */
const FREE_ATTEMPTS = 5;
const FIRST_LOCK_MS = 30 * 1000;
const MAX_LOCK_MS = 30 * 60 * 1000;

type PinRecord = { salt: string; hash: string; fails: number; lockUntil: number };

const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export type VerifyResult = { ok: true } | { ok: false; lockedUntil?: number; attemptsLeft?: number };

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hashPin(pin: string, salt: string): string {
  let h = sha256Hex(`${salt}:${pin}`);
  for (let i = 0; i < HASH_ROUNDS; i++) h = sha256Hex(`${h}:${salt}`);
  return h;
}

/** Record salvato, null se non c'è. Se l'archivio sicuro non risponde solleva un errore (chi chiama deve restare "chiuso"). */
async function read(): Promise<PinRecord | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY, OPTIONS);
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as PinRecord;
    return typeof r.salt === 'string' && typeof r.hash === 'string' ? { ...r, fails: r.fails ?? 0, lockUntil: r.lockUntil ?? 0 } : null;
  } catch {
    return null;
  }
}

async function write(r: PinRecord): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(r), OPTIONS);
}

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** Il codice è attivo. Se l'archivio non risponde si considera attivo: meglio chiedere il codice che lasciare l'app aperta. */
export async function isPinSet(): Promise<boolean> {
  try {
    return (await read()) !== null;
  } catch {
    return true;
  }
}

/** Imposta (o sostituisce) il codice e azzera i tentativi sbagliati. */
export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error(`Il codice deve essere di ${PIN_LENGTH} cifre`);
  const salt = randomSalt();
  await write({ salt, hash: hashPin(pin, salt), fails: 0, lockUntil: 0 });
}

/** Elimina il codice: l'app non è più protetta. */
export async function clearPin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(STORE_KEY, OPTIONS);
  } catch {
    // niente da eliminare
  }
}

/** Istante fino al quale i tentativi sono bloccati (0 = non bloccati). */
export async function getLockUntil(): Promise<number> {
  try {
    const r = await read();
    return r && r.lockUntil > Date.now() ? r.lockUntil : 0;
  } catch {
    return 0;
  }
}

/** Controlla il codice; ogni errore conta, e dopo 5 errori i tentativi si bloccano per 30 s, poi per il doppio a ogni errore (max 30 min). */
export async function verifyPin(pin: string): Promise<VerifyResult> {
  let r: PinRecord | null;
  try {
    r = await read();
  } catch {
    return { ok: false };
  }
  if (!r) return { ok: true };
  const now = Date.now();
  if (r.lockUntil > now) return { ok: false, lockedUntil: r.lockUntil };

  if (hashPin(pin, r.salt) === r.hash) {
    if (r.fails !== 0 || r.lockUntil !== 0) await write({ ...r, fails: 0, lockUntil: 0 });
    return { ok: true };
  }

  const fails = r.fails + 1;
  const over = fails - FREE_ATTEMPTS;
  const lockUntil = over >= 0 ? now + Math.min(MAX_LOCK_MS, FIRST_LOCK_MS * 2 ** over) : 0;
  await write({ ...r, fails, lockUntil });
  return lockUntil > 0 ? { ok: false, lockedUntil: lockUntil } : { ok: false, attemptsLeft: FREE_ATTEMPTS - fails };
}

/** Errori consecutivi sulla password di recupero dopo i quali l'app viene reimpostata. */
export const MAX_RECOVERY_FAILURES = 3;
const RECOVERY_KEY = 'cardapp.pinrecovery';

/** Errori consecutivi di recupero già fatti (persistono anche se l'app viene chiusa). */
export async function getRecoveryFailures(): Promise<number> {
  try {
    return Number(await SecureStore.getItemAsync(RECOVERY_KEY, OPTIONS)) || 0;
  } catch {
    return 0;
  }
}

/** Registra un errore di recupero e ritorna il totale. */
export async function addRecoveryFailure(): Promise<number> {
  const n = (await getRecoveryFailures()) + 1;
  try {
    await SecureStore.setItemAsync(RECOVERY_KEY, String(n), OPTIONS);
  } catch {
    // il conteggio vale comunque per questa richiesta
  }
  return n;
}

export async function clearRecoveryFailures(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(RECOVERY_KEY, OPTIONS);
  } catch {
    // niente da azzerare
  }
}
