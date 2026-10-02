import { authedGet } from '@/services/auth';
import type { Card, CardBalance, CardCounter, CardKind, CardMovement, CounterType } from '@/types/card';

type ApiContatore = {
  tipoAssociazione: number;
  tipoContatore: number;
  /** standard, euro, punti, sconto oppure altro. */
  tipo: string;
  nome: string | null;
  valore: number;
  limite: number | null;
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
  dataInserimento: string;
  ultimoUtilizzo: string;
  emittente: { ragioneSociale: string; citta: string | null };
  contatori: ApiContatore[];
};

type ApiCardResponse = { cod: number; msg?: string; card: ApiCard[] };

const COUNTER_TYPES: Record<string, CounterType> = {
  standard: 'standard',
  euro: 'euro',
  punti: 'points',
  sconto: 'discount',
};

function toCounter(k: ApiContatore): CardCounter {
  return { name: k.nome ?? '', type: COUNTER_TYPES[k.tipo] ?? 'other', amount: k.valore, limit: k.limite ?? undefined };
}

/** Saldo mostrato sulla card: l'importo in euro (prima quello dell'esercente emittente, poi uno con valore), altrimenti i punti. */
function pickBalance(contatori: ApiContatore[]): CardBalance | undefined {
  const pick = (tipo: string) => {
    const list = contatori.filter((k) => k.tipo === tipo);
    return list.find((k) => k.principale) ?? list.find((k) => k.valore !== 0) ?? list[0];
  };
  const euro = pick('euro');
  if (euro) return { type: 'euro', amount: euro.valore };
  const punti = pick('punti');
  if (punti) return { type: 'points', amount: punti.valore };
  return undefined;
}

/** Testo nel campo "Dati" della card che la identifica come gift card (il gestionale non ha un tipo apposito). */
const GIFT_MARKER = 'GIFT';

function isGift(dati: string | null): boolean {
  return dati?.trim().toUpperCase() === GIFT_MARKER;
}

/**
 * Aspetto della card: gift se il campo "Dati" vale GIFT; poi dai contatori: con il vecchio contatore postpagata
 * (tipo 2) è postpagata, con un importo in euro è prepagata, altrimenti (punti, sconto, nessun saldo) standard.
 */
function pickKind(contatori: ApiContatore[], dati: string | null): CardKind {
  if (isGift(dati)) return 'gift';
  if (contatori.some((k) => k.tipoContatore === 2)) return 'postpaid';
  if (contatori.some((k) => k.tipo === 'euro')) return 'prepaid';
  return 'standard';
}

function toCard(c: ApiCard): Card {
  const balance = pickBalance(c.contatori);
  const points = c.contatori.filter((k) => k.tipo === 'punti').reduce((sum, k) => sum + k.valore, 0);
  return {
    id: String(c.idCard),
    kind: pickKind(c.contatori, c.dati),
    code: c.codice,
    balance,
    extraPoints: balance?.type === 'euro' && points !== 0 ? points : undefined,
    issuer: { name: c.emittente.ragioneSociale, city: c.emittente.citta ?? undefined },
    blocked: c.bloccata,
    reference: c.riferimento ?? undefined,
    note: c.note ?? undefined,
    // il testo che marca la gift card non è un dato da mostrare
    data: isGift(c.dati) ? undefined : (c.dati ?? undefined),
    masterCode: c.codiceMaster ?? undefined,
    createdAt: c.dataInserimento,
    lastUsedAt: c.ultimoUtilizzo,
    counters: c.contatori.map(toCounter),
  };
}

/** Card del cliente collegato alla sessione. */
export async function fetchCards(): Promise<Card[]> {
  const res = await authedGet<ApiCardResponse>('/App/Card');
  return res.card.map(toCard);
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

/** Pagina di movimenti di una card del cliente (dal più recente); `page` parte da 1. */
export async function fetchMovements(cardId: string, page: number): Promise<{ movements: CardMovement[]; total: number }> {
  const res = await authedGet<ApiMovimentiResponse>(`/App/Movimenti?idCard=${encodeURIComponent(cardId)}&pagina=${page}&dimensione=${MOVEMENTS_PAGE_SIZE}`);
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
