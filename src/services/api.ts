const TIMEOUT_MS = 15000;

/**
 * Indirizzo del servizio cloud per i clienti (login, registrazione, dati esercente, card).
 * Si può forzare con EXPO_PUBLIC_CLOUD_URL (es. http://<pc>:5000 per il servizio locale di test).
 */
export const CLOUD_URL = (process.env.EXPO_PUBLIC_CLOUD_URL || 'https://wsclienticloud.skyoneserver.it').replace(/\/+$/, '');

/** Errore restituito dal backend (cod diverso da 0) o di rete (cod -1); `status` è lo stato HTTP della risposta, se c'è stata. */
export class ApiError extends Error {
  constructor(
    public readonly cod: number,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

/** Errore temporaneo (rete assente, troppe richieste, server in errore): non è un verdetto sulle credenziali. */
export function isTransientError(e: unknown): boolean {
  return e instanceof ApiError && (e.cod === -1 || e.cod === 429 || (e.status !== undefined && e.status >= 500));
}

/** Messaggio da mostrare all'utente per un errore qualsiasi. */
export function errorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Errore imprevisto';
}

/** Busta comune di tutte le risposte del cloud: `cod` 0 = ok, altrimenti `msg` spiega il problema. */
export type Envelope = { cod: number; msg?: string };

async function request<T extends Envelope>(method: 'GET' | 'POST', path: string, body?: unknown, accessToken?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${CLOUD_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : null),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : null),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    // 401 "vero" (token assente, scaduto o non valido): arriva dal controllo del token, senza corpo
    if (res.status === 401) throw new ApiError(401, 'Sessione scaduta', 401);
    if (res.status === 429) throw new ApiError(429, 'Troppe richieste, riprova tra un minuto', 429);
    let data: T;
    try {
      data = (await res.json()) as T;
    } catch {
      // risposta senza JSON valido (es. pagina di errore del server): il server c'è ma non risponde come previsto
      throw new ApiError(-1, res.status >= 500 ? 'Servizio non disponibile, riprova più tardi' : 'Risposta del server non valida', res.status);
    }
    if (data.cod !== 0) throw new ApiError(data.cod, data.msg || 'Errore', res.status);
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(-1, 'Server non raggiungibile');
  } finally {
    clearTimeout(timer);
  }
}

/** POST JSON al servizio cloud clienti; solleva ApiError se la risposta ha cod diverso da 0 o se il server non è raggiungibile. */
export function cloudPost<T extends Envelope>(path: string, body: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

/** POST JSON con il token cliente nell'intestazione Authorization (401 = token scaduto o non valido). */
export function cloudPostAuth<T extends Envelope>(path: string, body: unknown, accessToken: string): Promise<T> {
  return request<T>('POST', path, body, accessToken);
}

/** GET senza Authorization (l'eventuale token va nel percorso). */
export function cloudGet<T extends Envelope>(path: string): Promise<T> {
  return request<T>('GET', path);
}
