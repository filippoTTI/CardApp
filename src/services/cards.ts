import { cloudAuthedPostFor } from '@/services/auth';
import type { Card, CardBalance, CardCounter, CardKind, CardMovement, CounterType } from '@/types/card';

type ApiContatore = {
  /** 0 = card, 1 = esercente, 2 = circuito. */
  tipoAssociazione: number;
  /** 0 = punti (l'unico tipo gestito dal gestionale per ora). */
  tipoContatore: number;
  /** Ragione sociale dell'esercente o descrizione del circuito a cui appartiene il contatore. */
  nome: string | null;
  conta: number;
  contatoreLimite: number | null;
  contatoreDati: string | null;
  /** Contatore dell'esercente che ha emesso la card. */
  principale: boolean;
};

type ApiCard = {
  idCard: number;
  codice: string;
  bloccata: boolean;
  riferimento: string | null;
  note: string | null;
  dati: string | null;
  codiceMaster: string | null;
  /** Formato yyyyMMdd. */
  dataInserimento: string;
  /** Formato yyyyMMddHHmmss. */
  ultimoUtilizzo: string;
  emittente: { ragioneSociale: string; citta: string | null } | null;
  contatori: ApiContatore[];
};

type ApiCardResponse = { cod: number; msg?: string; card: ApiCard[] };

const COUNTER_TYPES: Record<string, CounterType> = {
  standard: 'standard',
  euro: 'euro',
  punti: 'points',
  sconto: 'discount',
};

const TIPO_PUNTI = 0;

function counterType(k: ApiContatore): CounterType {
  return k.tipoContatore === TIPO_PUNTI ? 'points' : 'other';
}

function toCounter(k: ApiContatore, fallbackName: string): CardCounter {
  return { name: k.nome?.trim() || fallbackName, type: counterType(k), amount: k.conta, limit: k.contatoreLimite ?? undefined };
}

/** Saldo mostrato sulla card: i punti del contatore dell'esercente emittente, altrimenti il primo contatore a punti. */
function pickBalance(contatori: ApiContatore[]): CardBalance | undefined {
  const punti = contatori.filter((k) => counterType(k) === 'points');
  const k = punti.find((c) => c.principale) ?? punti[0];
  return k ? { type: 'points', amount: k.conta } : undefined;
}

/** Testo nel campo "Dati" della card che la identifica come gift card (il gestionale non ha un tipo apposito). */
const GIFT_MARKER = 'GIFT';

function isGift(dati: string | null): boolean {
  return dati?.trim().toUpperCase() === GIFT_MARKER;
}

function toCard(c: ApiCard, accountKey: string, fallbackIssuer: string): Card {
  const issuerName = c.emittente?.ragioneSociale?.trim() || fallbackIssuer;
  const kind: CardKind = isGift(c.dati) ? 'gift' : 'standard';
  return {
    id: String(c.idCard),
    accountKey,
    kind,
    code: c.codice,
    balance: pickBalance(c.contatori),
    issuer: { name: issuerName, city: c.emittente?.citta ?? undefined },
    blocked: c.bloccata,
    reference: c.riferimento ?? undefined,
    note: c.note ?? undefined,
    // il testo che marca la gift card non è un dato da mostrare
    data: isGift(c.dati) ? undefined : (c.dati ?? undefined),
    masterCode: c.codiceMaster ?? undefined,
    createdAt: c.dataInserimento,
    lastUsedAt: c.ultimoUtilizzo?.slice(0, 8),
    counters: c.contatori.map((k) => toCounter(k, issuerName)),
  };
}

/** Card di un account salvato (chiave esercente + email), tramite il cloud che interroga il gestionale card. */
export async function fetchCards(accountKey: string, fallbackIssuer = ''): Promise<Card[]> {
  const res = await cloudAuthedPostFor<ApiCardResponse>(accountKey, '/AUC/CardCliente');
  return (res.card ?? []).map((c) => toCard(c, accountKey, fallbackIssuer));
}

type ApiMovimento = {
  idMovimento: number;
  dataOra: string;
  tipo: 'ricarica' | 'spesa' | 'accredito';
  importo: number;
  saldoDopo: number;
  contatore: string;
  descrizione: string | null;
  documento: string | null;
  esercente: string;
  circuito: string | null;
  codiceCardSlave: string | null;
  righe: { descrizione: string | null; unitaMisura: string | null; quantita: number; totale: number }[];
};

type ApiMovimentiResponse = { cod: number; msg?: string; movimenti: ApiMovimento[]; totale: number };

const MOVEMENT_KINDS: Record<ApiMovimento['tipo'], CardMovement['kind']> = {
  ricarica: 'recharge',
  spesa: 'expense',
  accredito: 'credit',
};

const MOVEMENTS_PAGE_SIZE = 20;

/** Pagina di movimenti di una card di un account (dal più recente); `page` parte da 1. */
export async function fetchMovements(accountKey: string, cardId: string, page: number): Promise<{ movements: CardMovement[]; total: number }> {
  const res = await cloudAuthedPostFor<ApiMovimentiResponse>(accountKey, '/AUC/MovimentiCardCliente', {
    idCard: Number(cardId),
    pagina: page,
    dimensione: MOVEMENTS_PAGE_SIZE,
  });
  return {
    total: res.totale,
    movements: res.movimenti.map((m) => ({
      id: m.idMovimento,
      kind: MOVEMENT_KINDS[m.tipo],
      dateTime: m.dataOra,
      amount: m.importo,
      balanceAfter: m.saldoDopo,
      counter: COUNTER_TYPES[m.contatore] ?? 'other',
      description: m.descrizione ?? undefined,
      document: m.documento ?? undefined,
      merchant: m.esercente,
      circuit: m.circuito ?? undefined,
      slaveCode: m.codiceCardSlave ?? undefined,
      lines: m.righe.map((r) => ({
        description: r.descrizione ?? undefined,
        unit: r.unitaMisura ?? undefined,
        quantity: r.quantita,
        total: r.totale,
      })),
    })),
  };
}

type ApiBloccaCardResponse = { cod: number; msg?: string; bloccata: boolean; modificata: boolean };

/**
 * Blocca o sblocca una card del cliente. `message` è valorizzato solo se la card era già nello stato richiesto
 * (es. "la card è già bloccata."); solleva ApiError se l'operazione non riesce.
 */
export async function setCardBlocked(accountKey: string, cardId: string, blocked: boolean): Promise<{ blocked: boolean; message?: string }> {
  const res = await cloudAuthedPostFor<ApiBloccaCardResponse>(accountKey, '/AUC/BloccaCardCliente', { idCard: Number(cardId), blocca: blocked });
  return { blocked: res.bloccata, message: res.modificata ? undefined : res.msg || undefined };
}
