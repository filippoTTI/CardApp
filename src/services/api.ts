import Constants from 'expo-constants';

const API_PORT = 5150;
const TIMEOUT_MS = 15000;

/**
 * Indirizzo del backend wsCard.
 * In sviluppo usa lo stesso computer che serve l'app (host di Metro) sulla porta del backend;
 * si può forzare con la variabile EXPO_PUBLIC_API_URL (es. in .env.local).
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:${API_PORT}`;
}

export const API_URL = resolveBaseUrl();

/** Errore restituito dal backend (cod diverso da 0) o di rete (cod -1). */
export class ApiError extends Error {
  constructor(
    public readonly cod: number,
    message: string,
  ) {
    super(message);
  }
}

type Envelope = { cod: number; msg?: string };

async function request<T extends Envelope>(method: 'GET' | 'POST', path: string, body?: unknown, accessToken?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : null),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    // 401 "vero" (token assente, scaduto o non valido): arriva dal controllo del token, senza corpo
    if (res.status === 401) throw new ApiError(401, 'Sessione scaduta');
    if (res.status === 429) throw new ApiError(429, 'Troppe richieste, riprova tra un minuto');
    const data = (await res.json()) as T;
    if (data.cod !== 0) throw new ApiError(data.cod, data.msg || 'Errore');
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(-1, 'Server non raggiungibile');
  } finally {
    clearTimeout(timer);
  }
}

/** POST JSON; solleva ApiError se la risposta ha cod diverso da 0 o se il server non è raggiungibile. */
export function apiPost<T extends Envelope>(path: string, body: unknown, accessToken?: string): Promise<T> {
  return request<T>('POST', path, body, accessToken);
}

/** GET con access token; stessi errori di apiPost. */
export function apiGet<T extends Envelope>(path: string, accessToken: string): Promise<T> {
  return request<T>('GET', path, undefined, accessToken);
}
