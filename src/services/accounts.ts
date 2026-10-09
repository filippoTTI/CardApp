import * as SecureStore from 'expo-secure-store';

/** Account del cliente presso un esercente; le credenziali servono a rifare il login quando il token scade. */
export type SavedAccount = {
  codEsercente: string;
  /** Nome mostrato al cliente al posto del codice. */
  ragioneSociale: string;
  email: string;
  password: string;
};

type Stored = { accounts: SavedAccount[]; active: string | null };

/**
 * Le credenziali stanno nell'archivio sicuro leggibile solo a telefono sbloccato e mai trasferito su altri dispositivi
 * (né incluso nei backup), come il codice di sblocco. La chiave precedente era salvata senza queste restrizioni:
 * al primo avvio viene spostata sulla nuova e cancellata.
 */
const STORE_KEY = 'cardapp.accounts.v2';
const LEGACY_STORE_KEY = 'cardapp.accounts';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

let cache: Stored | null = null;

function parse(raw: string): Stored {
  const parsed = JSON.parse(raw) as Stored;
  return { accounts: parsed.accounts ?? [], active: parsed.active ?? null };
}

async function migrateLegacy(): Promise<Stored | null> {
  const raw = await SecureStore.getItemAsync(LEGACY_STORE_KEY);
  if (!raw) return null;
  const stored = parse(raw);
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(stored), OPTIONS);
  await SecureStore.deleteItemAsync(LEGACY_STORE_KEY);
  return stored;
}

/** Chiave di un account: lo stesso cliente presso esercenti diversi (o con email diverse) resta distinto. */
export function accountKey(a: { codEsercente: string; email: string }): string {
  return `${a.codEsercente.trim().toUpperCase()}|${a.email.trim().toLowerCase()}`;
}

async function load(): Promise<Stored> {
  if (cache) return cache;
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY, OPTIONS);
    const stored = raw ? parse(raw) : await migrateLegacy();
    if (stored) {
      cache = stored;
      return cache;
    }
  } catch {
    // archivio non disponibile (es. web) o contenuto illeggibile: si riparte senza account salvati
  }
  cache = { accounts: [], active: null };
  return cache;
}

async function save(next: Stored): Promise<void> {
  cache = next;
  try {
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next), OPTIONS);
  } catch {
    // gli account restano validi finché l'app è aperta
  }
}

export async function listAccounts(): Promise<SavedAccount[]> {
  return (await load()).accounts;
}

export async function getActiveAccount(): Promise<SavedAccount | null> {
  const { accounts, active } = await load();
  return accounts.find((a) => accountKey(a) === active) ?? null;
}

/** Account salvato con quella chiave, null se non c'è. */
export async function getAccount(key: string): Promise<SavedAccount | null> {
  return (await load()).accounts.find((a) => accountKey(a) === key) ?? null;
}

/** Aggiunge l'account (o ne aggiorna password e ragione sociale se esiste già) e lo rende attivo. */
export async function upsertAccount(account: SavedAccount): Promise<void> {
  const cur = await load();
  const key = accountKey(account);
  const exists = cur.accounts.some((a) => accountKey(a) === key);
  const accounts = exists ? cur.accounts.map((a) => (accountKey(a) === key ? account : a)) : [...cur.accounts, account];
  await save({ accounts, active: key });
}

/** Account attivo (null = nessuno: all'avvio si apre il login). Gli account restano salvati. */
export async function setActiveKey(key: string | null): Promise<void> {
  const cur = await load();
  await save({ ...cur, active: key });
}

/** Aggiorna la password salvata di un account (senza cambiare quello attivo). */
export async function setAccountPassword(key: string, password: string): Promise<void> {
  const cur = await load();
  await save({ ...cur, accounts: cur.accounts.map((a) => (accountKey(a) === key ? { ...a, password } : a)) });
}

/** Elimina tutti gli account salvati sul dispositivo (non tocca nulla sul cloud). */
export async function clearAccounts(): Promise<void> {
  await save({ accounts: [], active: null });
}

/** Elimina un account salvato; se era quello attivo non resta nessun account attivo. */
export async function removeAccount(key: string): Promise<void> {
  const cur = await load();
  await save({ accounts: cur.accounts.filter((a) => accountKey(a) !== key), active: cur.active === key ? null : cur.active });
}
