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

const STORE_KEY = 'cardapp.accounts';

let cache: Stored | null = null;

/** Chiave di un account: lo stesso cliente presso esercenti diversi (o con email diverse) resta distinto. */
export function accountKey(a: { codEsercente: string; email: string }): string {
  return `${a.codEsercente.trim().toUpperCase()}|${a.email.trim().toLowerCase()}`;
}

async function load(): Promise<Stored> {
  if (cache) return cache;
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Stored;
      cache = { accounts: parsed.accounts ?? [], active: parsed.active ?? null };
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
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
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

export async function getActiveKey(): Promise<string | null> {
  return (await load()).active;
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

/** Elimina un account salvato; se era quello attivo non resta nessun account attivo. */
export async function removeAccount(key: string): Promise<void> {
  const cur = await load();
  await save({ accounts: cur.accounts.filter((a) => accountKey(a) !== key), active: cur.active === key ? null : cur.active });
}
