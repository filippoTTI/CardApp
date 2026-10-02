import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { ApiError, apiGet, apiPost } from '@/services/api';
import { getGoogleIdentity } from '@/services/google';

export type AuthCliente = {
  idAna: number;
  email: string;
  nome: string;
  cognome: string;
  emailVerificata: boolean;
  /** Cellulare o telefono, se presente. */
  telefono: string | null;
  /** Data di creazione dell'accesso, formato yyyyMMdd. */
  membroDal: string;
  /** True se il cliente può accedere con email e password. */
  accessoPassword: boolean;
  /** Provider esterni collegati (es. google). */
  provider: string[];
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  /** Durata dell'access token in secondi. */
  expiresIn: number;
  cliente: AuthCliente;
};

type AuthResponse = AuthSession & { cod: number; msg?: string };

const REFRESH_KEY = 'cardapp.refreshToken';

/** Sessione corrente; del refresh token viene tenuta una copia nell'archivio sicuro del dispositivo. */
let session: AuthSession | null = null;

async function saveRefreshToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(REFRESH_KEY, token);
    else await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {
    // archivio non disponibile (es. web): la sessione resta valida solo finché l'app è aperta
  }
}

export function getSession(): AuthSession | null {
  return session;
}

const device = Platform.OS;

async function store(res: AuthResponse): Promise<AuthSession> {
  session = { accessToken: res.accessToken, refreshToken: res.refreshToken, expiresIn: res.expiresIn, cliente: res.cliente };
  await saveRefreshToken(res.refreshToken);
  return session;
}

/** Accesso con email e password. Solleva ApiError con il messaggio da mostrare. */
export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  return store(await apiPost<AuthResponse>('/Auth/Login', { email: email.trim(), password, device }));
}

/** Registrazione con email e password; ad account creato la sessione è già attiva. */
export async function register(input: { nome: string; cognome: string; email: string; telefono?: string; password: string }): Promise<AuthSession> {
  const body = { ...input, nome: input.nome.trim(), cognome: input.cognome.trim(), email: input.email.trim(), telefono: input.telefono?.trim() || undefined, device };
  return store(await apiPost<AuthResponse>('/Auth/Registrazione', body));
}

export type RefreshResult = { status: 'ok'; session: AuthSession } | { status: 'expired' } | { status: 'offline' };

async function readRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}

async function doRefresh(): Promise<RefreshResult> {
  const token = session?.refreshToken ?? (await readRefreshToken());
  if (!token) return { status: 'expired' };
  try {
    return { status: 'ok', session: await store(await apiPost<AuthResponse>('/Auth/Refresh', { refreshToken: token, device })) };
  } catch (e) {
    // sessione scaduta o rifiutata dal server: per riaccedere servono di nuovo le credenziali
    if (e instanceof ApiError && e.cod === 401) {
      session = null;
      await saveRefreshToken(null);
      return { status: 'expired' };
    }
    // rete o errore temporaneo: il token resta, si riprova più tardi
    return { status: 'offline' };
  }
}

let inflight: Promise<RefreshResult> | null = null;

/**
 * Rinnova la sessione con il refresh token (ogni rinnovo azzera la scadenza dei 5 minuti).
 * Le chiamate contemporanee condividono la stessa richiesta: il refresh token è monouso e usarlo due volte
 * farebbe chiudere tutte le sessioni.
 */
export function refreshSession(): Promise<RefreshResult> {
  inflight ??= doRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

/**
 * Accesso (o registrazione al primo accesso) con Google. Ritorna null se l'utente annulla.
 * Il backend verifica il token e, se l'email è già registrata, collega Google allo stesso cliente.
 */
export async function signInWithGoogle(): Promise<AuthSession | null> {
  const identity = await getGoogleIdentity();
  if (!identity) return null;
  return store(await apiPost<AuthResponse>('/Auth/LoginSocial', { provider: 'google', ...identity, device }));
}

/** Ripristina la sessione all'avvio con il refresh token salvato; null se scaduta, assente o server non raggiungibile. */
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
  const r = await refreshSession();
  if (r.status === 'expired') throw new ApiError(401, 'Sessione scaduta');
  if (r.status === 'offline') throw new ApiError(-1, 'Server non raggiungibile');
  return call(r.session.accessToken);
}

/** GET autenticato. */
export function authedGet<T extends { cod: number; msg?: string }>(path: string): Promise<T> {
  return authed((token) => apiGet<T>(path, token));
}

/**
 * Elimina l'account del cliente sul server (accesso, provider e sessioni) e cancella la sessione locale.
 * Solleva ApiError se l'eliminazione non è riuscita: in quel caso la sessione resta com'è.
 */
export async function deleteAccountRemote(): Promise<void> {
  await authed((token) => apiPost('/Auth/EliminaAccount', {}, token));
  session = null;
  await saveRefreshToken(null);
}

/** Chiude la sessione sul server (revoca il refresh token); gli errori di rete non bloccano l'uscita. */
export async function signOutRemote(): Promise<void> {
  const current = session;
  session = null;
  await saveRefreshToken(null);
  if (!current) return;
  try {
    await apiPost('/Auth/Logout', { refreshToken: current.refreshToken });
  } catch {
    // il token scade comunque da solo
  }
}
