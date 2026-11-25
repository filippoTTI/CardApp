import type { Envelope } from '@/services/api';
import { cloudAuthedPostFor } from '@/services/auth';

/**
 * Identificativo della richiesta di pagamento contenuto nel QR che la cassa mostra (`cardapp://pay/<id>`).
 * Si accetta anche un altro indirizzo che finisce con `/pay/<id>` oppure il solo identificativo (esadecimale, 32 caratteri).
 * Null se il testo non è un QR di pagamento. Il formato va cambiato solo qui.
 */
export function parsePaymentCode(data: string): string | null {
  const text = (data ?? '').trim();
  const link = text.match(/(?:^|\/)pay\/([A-Za-z0-9]{16,64})\/?(?:[?#].*)?$/);
  if (link) return link[1].toLowerCase();
  return /^[A-Fa-f0-9]{32}$/.test(text) ? text.toLowerCase() : null;
}

/**
 * Contenuto del QR di pagamento: id della richiesta e, se la cassa lo indica (`?e=<codice esercente>`), l'esercente che incassa.
 * Con il codice esercente l'app sa subito con quali account e card può pagare, senza tentativi. Null se non è un QR di pagamento.
 */
export function parsePaymentQr(data: string): { id: string; codEsercente?: string; circuit: boolean } | null {
  const id = parsePaymentCode(data);
  if (!id) return null;
  const e = (data ?? '').match(/[?&]e=([^&#]+)/);
  let codEsercente: string | undefined;
  try {
    codEsercente = e ? decodeURIComponent(e[1]).trim().toUpperCase() || undefined : undefined;
  } catch {
    codEsercente = undefined;
  }
  // `c` presente: la cassa e' in modalita' circuito, la card puo' essere di un altro esercente del circuito
  return { id, codEsercente, circuit: /[?&]c=[^&#]+/.test(data ?? '') };
}

/** Stato della richiesta lato server: 0 in attesa, 1 pagata, 2 rifiutata, 3 scaduta, 4 annullata dalla cassa. */
export type PaymentStatus = 0 | 1 | 2 | 3 | 4;

export type PaymentRequest = {
  id: string;
  /** Importo da pagare in euro. */
  amount: number;
  /** Ragione sociale dell'esercente che incassa. */
  merchant: string;
  status: PaymentStatus;
  /** Secondi di validità rimasti. */
  secondsLeft: number;
  /** Richiesta di circuito: pagabile anche con card di altri esercenti del circuito. */
  circuit: boolean;
  /** Id delle card del cliente con cui si può pagare (assente se il server non lo indica). */
  validCards?: number[];
  /** Istante (ms) in cui l'app ha letto la richiesta: `secondsLeft` vale da qui. */
  receivedAt: number;
};

/** Perché una richiesta non è più pagabile, da mostrare al cliente. */
export const PAYMENT_STATUS_MESSAGE: Record<PaymentStatus, string> = {
  0: '',
  1: 'Questo pagamento è già stato completato',
  2: 'Questo pagamento è stato rifiutato',
  3: 'Il tempo per pagare è scaduto: chiedi in cassa un nuovo codice',
  4: 'Il pagamento è stato annullato dalla cassa',
};

type ApiRichiesta = Envelope & {
  idRichiesta: string;
  importo: number;
  esercente: string;
  stato: PaymentStatus;
  scadenzaSecondi: number;
  circuito?: boolean;
  cardValide?: number[];
};
type ApiPaga = Envelope & { saldoResiduo: number; codiceCard: string };

/**
 * Legge la richiesta di pagamento inquadrata: la cassa la vede come "letta" e mostra che il cliente sta confermando.
 * Solleva ApiError se la richiesta non esiste o il server non risponde.
 */
export async function fetchPaymentRequest(accountKey: string, id: string): Promise<PaymentRequest> {
  const res = await cloudAuthedPostFor<ApiRichiesta>(accountKey, '/AUC/RichiestaPagamento', { idRichiesta: id });
  return {
    id: res.idRichiesta,
    amount: res.importo,
    merchant: res.esercente,
    status: res.stato,
    secondsLeft: res.scadenzaSecondi,
    circuit: !!res.circuito,
    validCards: res.cardValide,
    receivedAt: Date.now(),
  };
}

/**
 * Conferma il pagamento con la card scelta: il server registra quale card paga e la cassa prosegue con il suo flusso
 * normale (è lei a scalare credito e punti). Solleva ApiError con il motivo se la card non è utilizzabile per questo esercente
 * o la richiesta non è più valida (scaduta, annullata, già confermata).
 */
export async function payPaymentRequest(accountKey: string, id: string, cardId: string): Promise<void> {
  await cloudAuthedPostFor<ApiPaga>(accountKey, '/AUC/PagaRichiesta', { idRichiesta: id, idCard: Number(cardId) });
}
