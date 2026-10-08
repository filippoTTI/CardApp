import { accountKey, getActiveAccount, listAccounts, removeAccount, setActiveKey, upsertAccount, type SavedAccount } from '@/services/accounts';
import { ApiError, apiGet, apiPost, cloudGet, cloudPost } from '@/services/api';

export type AuthCliente = {
  idAna: number;
  email: string;
  nome: string;
  cognome: string;
  emailVerificata: boolean;
  /** Cellulare o telefono, se presente. */
  telefono: string | null;
  /** Data di creazione dell'accesso, formato yyyyMMdd (non fornita dal cloud). */
  membroDal: string;
  /** True se il cliente può accedere con email e password. */
  accessoPassword: boolean;
  /** Provider esterni collegati (es. google). */
  provider: string[];
  /** Chiave dell'account salvato (esercente + email). */
  accountKey: string;
  /** Ragione sociale dell'esercente presso cui il cliente è registrato. */
  esercente: string;
};

export type AuthSession = {
  accessToken: string;
  cliente: AuthCliente;
};

type LoginResponse = { cod: number; msg?: string; token: string; idCliente: number };
type VerificaResponse = { cod: number; msg?: string; idCliente: number; nome: string | null; cognome: string | null; email: string | null; cel: string | null; codEsercente: string };
type InfoEsercenteResponse = { cod: number; msg?: string; codEsercente: string; ragioneSociale: string | null; citta: string | null };

/** Sessione corrente (token cloud dell'account attivo); le credenziali stanno negli account salvati. */
let session: AuthSession | null = null;

export function getSession(): AuthSession | null {
  return session;
}

/** Ragione sociale di un esercente a partire dal suo codice; solleva ApiError se il codice non è valido. */
export async function fetchEsercente(codEsercente: string): Promise<{ codEsercente: string; ragioneSociale: string }> {
  const res = await cloudGet<InfoEsercenteResponse>(`/CLE/InfoEsercente/${encodeURIComponent(codEsercente.trim())}`);
  return { codEsercente: res.codEsercente, ragioneSociale: res.ragioneSociale?.trim() || 'Esercente' };
}

/** Login sul cloud con le credenziali dell'account e lettura del profilo; imposta la sessione corrente. */
async function loginCloud(acc: SavedAccount): Promise<AuthSession> {
  const login = await cloudPost<LoginResponse>('/AUC/LoginCliente', { CodEsercente: acc.codEsercente, User: acc.email, PWD: acc.password });
  const info = await cloudGet<VerificaResponse>(`/AUC/VerificaTokenAccessoCliente/${encodeURIComponent(login.token)}`);
  session = {
    accessToken: login.token,
    cliente: {
      idAna: info.idCliente || login.idCliente,
      email: info.email || acc.email,
      nome: info.nome ?? '',
      cognome: info.cognome ?? '',
      emailVerificata: true,
      telefono: info.cel || null,
      membroDal: '',
      accessoPassword: true,
      provider: [],
      accountKey: accountKey(acc),
      esercente: acc.ragioneSociale,
    },
  };
  return session;
}

/**
 * Accesso con email e password presso un esercente. Ad accesso riuscito l'account viene salvato (o aggiornato)
 * e reso attivo, senza toccare gli altri. Solleva ApiError con il messaggio da mostrare.
 */
export async function signInWithPassword(email: string, password: string, codEsercente: string): Promise<AuthSession> {
  const esercente = await fetchEsercente(codEsercente);
  const acc: SavedAccount = { codEsercente: esercente.codEsercente, ragioneSociale: esercente.ragioneSociale, email: email.trim(), password };
  const s = await loginCloud(acc);
  await upsertAccount(acc);
  return s;
}

/** Accesso con un account già salvato (senza riscrivere la password). */
export async function switchAccount(key: string): Promise<AuthSession> {
  const acc = (await listAccounts()).find((a) => accountKey(a) === key);
  if (!acc) throw new ApiError(-1, 'Account non trovato');
  const s = await loginCloud(acc);
  await setActiveKey(key);
  return s;
}

export { listAccounts, type SavedAccount };

/** Elimina un account salvato dal dispositivo; se era quello in uso chiude anche la sessione. */
export async function forgetAccount(key: string): Promise<void> {
  if (session?.cliente.accountKey === key) session = null;
  await removeAccount(key);
}

export type RefreshResult = { status: 'ok'; session: AuthSession } | { status: 'expired' } | { status: 'offline' };

async function doRefresh(force: boolean): Promise<RefreshResult> {
  if (session && !force) return { status: 'ok', session };
  const acc = await getActiveAccount();
  if (!acc) return { status: 'expired' };
  try {
    return { status: 'ok', session: await loginCloud(acc) };
  } catch (e) {
    // credenziali non più valide (es. password cambiata): per riaccedere servono di nuovo
    if (e instanceof ApiError && e.cod !== -1) {
      session = null;
      return { status: 'expired' };
    }
    return { status: 'offline' };
  }
}

let inflight: Promise<RefreshResult> | null = null;

/**
 * Ripristina o rinnova la sessione dell'account attivo rifacendo il login con le credenziali salvate.
 * Con `force` rifà il login anche se una sessione esiste (token scaduto). Le chiamate contemporanee condividono la stessa richiesta.
 */
export function refreshSession(force = false): Promise<RefreshResult> {
  inflight ??= doRefresh(force).finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Ripristina la sessione all'avvio con l'account attivo; null se assente, rifiutato o server non raggiungibile. */
export async function restoreSession(): Promise<AuthSession | null> {
  const r = await refreshSession();
  return r.status === 'ok' ? r.session : null;
}

/**
 * Esegue una chiamata autenticata: se l'access token risulta scaduto rinnova la sessione e riprova una volta.
 * Se la sessione non è più valida solleva ApiError 401.
 */
async function authed<T>(call: (accessToken: string) => Promise<T>): Promise<T> {
  if (!session) throw new ApiError(401, 'Sessione scaduta');
  try {
    return await call(session.accessToken);
  } catch (e) {
    if (!(e instanceof ApiError) || e.cod !== 401) throw e;
  }
  const r = await refreshSession(true);
  if (r.status === 'expired') throw new ApiError(401, 'Sessione scaduta');
  if (r.status === 'offline') throw new ApiError(-1, 'Server non raggiungibile');
  return call(r.session.accessToken);
}

/** GET autenticato. */
export function authedGet<T extends { cod: number; msg?: string }>(path: string): Promise<T> {
  return authed((token) => apiGet<T>(path, token));
}

/** POST autenticato. */
export function authedPost<T extends { cod: number; msg?: string }>(path: string, body: unknown): Promise<T> {
  return authed((token) => apiPost<T>(path, body, token));
}

const NON_DISPONIBILE = 'Funzione non ancora disponibile con il nuovo accesso';

type RegistraResponse = { cod: number; msg?: string; idCliente: number; emailDaConfermare: boolean };

/**
 * Registrazione presso un esercente (nome utente = email). Se l'esercente richiede la conferma via email l'accesso
 * non è subito possibile (`emailDaConfermare`); altrimenti l'account è attivo e il chiamante può fare il login.
 */
export async function register(input: { nome: string; cognome: string; email: string; telefono?: string; password: string }, codEsercente: string): Promise<{ emailDaConfermare: boolean }> {
  const esercente = await fetchEsercente(codEsercente);
  const res = await cloudPost<RegistraResponse>('/CLE/RegistraClienteApp', {
    CodEsercente: esercente.codEsercente,
    Nome: input.nome.trim(),
    Cognome: input.cognome.trim(),
    EMail: input.email.trim(),
    Cellulare: input.telefono?.trim() || null,
    Pwd: input.password,
  });
  return { emailDaConfermare: res.emailDaConfermare };
}

/** Invia all'email del cliente il link per reimpostare la password (risponde ok anche se l'account non esiste). */
export async function requestPasswordReset(email: string, codEsercente: string): Promise<void> {
  const esercente = await fetchEsercente(codEsercente);
  await cloudPost('/CLE/ResetPwdClienteApp', { CodEsercente: esercente.codEsercente, EMail: email.trim() });
}

/** Reinvia l'email di conferma dell'account (risponde ok anche se l'account non esiste). */
export async function resendConfirmation(email: string, codEsercente: string): Promise<void> {
  const esercente = await fetchEsercente(codEsercente);
  await cloudPost('/CLE/ReinoltraConfermaClienteApp', { CodEsercente: esercente.codEsercente, EMail: email.trim() });
}

/** Google non è previsto per ora con il login cloud. */
export async function signInWithGoogle(): Promise<AuthSession | null> {
  throw new ApiError(-1, NON_DISPONIBILE);
}

/** TODO: sostituito dal reset password via email. */
export async function changePassword(_currentPassword: string, _newPassword: string): Promise<void> {
  throw new ApiError(-1, NON_DISPONIBILE);
}

/** Elimina dal dispositivo l'account in uso (non cancella nulla sul cloud). */
export async function deleteAccountRemote(): Promise<void> {
  const key = session?.cliente.accountKey;
  if (key) await forgetAccount(key);
}

/** Esce dall'account in uso: gli account restano salvati ma all'avvio si riapre il login. */
export async function signOutRemote(): Promise<void> {
  session = null;
  await setActiveKey(null);
}
