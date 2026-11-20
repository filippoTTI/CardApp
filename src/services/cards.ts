import { cloudAuthedPostFor } from '@/services/auth';
import type {
  Card,
  CardBalance,
  CardCounter,
  CardDiscount,
  CardKind,
  CardMovement,
  CardThreshold,
  CardThresholds,
  CounterType,
  MovementCounter,
} from '@/types/card';

type ApiContatore = {
  /** 0 = card, 1 = esercente, 2 = circuito. */
  tipoAssociazione: number;
  /** 0 = standard (nessun saldo), 1 = euro, 4 = punti, 5 = sconto (resta a 0: il valore è in `sconto` della card). */
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
  /** Colore scelto dall'esercente (es. "#1f4634"). */
  colore: string | null;
  /** Standard, PrePagata o PostPagata. */
  tipo: string | null;
  /** Sconto attivo del dettaglio della card: Percentuale, Valore o Tipologia; null se non fa sconti. */
  tipoSconto?: string | null;
  /** Valore dello sconto (percentuale o euro); 0 per Tipologia. */
  sconto?: number;
  /** Unità delle soglie del premio: Punti o Euro; null se la card non ne ha. */
  soglieIn?: string | null;
  /** Soglie del premio dalla più bassa, con il testo del buono. */
  soglie?: { soglia: number; buono: string | null }[] | null;
  codiceMaster: string | null;
  /** Formato yyyyMMdd. */
  dataInserimento: string;
  /** Formato yyyyMMddHHmmss. */
  ultimoUtilizzo: string;
  emittente: { ragioneSociale: string; citta: string | null } | null;
  contatori: ApiContatore[];
};

type ApiCardResponse = { cod: number; msg?: string; card: ApiCard[] };

/** Nome del contatore nei movimenti (`/CLI/MovimentiCardCliente`) -> tipo dell'app. */
const COUNTER_TYPES: Record<string, CounterType> = {
  standard: 'standard',
  euro: 'euro',
  punti: 'points',
  sconto: 'discount',
};

/** Tipo contatore del gestionale (CardContDat.TipoContatore, wsCard.CONTATORE_*) -> tipo dell'app. */
const TIPI_CONTATORE: Record<number, CounterType> = {
  0: 'standard',
  1: 'euro',
  4: 'points',
  5: 'discount',
};

function toCounter(k: ApiContatore, fallbackName: string): CardCounter {
  return {
    name: k.nome?.trim() || fallbackName,
    type: TIPI_CONTATORE[k.tipoContatore] ?? 'other',
    amount: k.conta,
    limit: k.contatoreLimite ?? undefined,
    main: k.principale,
  };
}

/** Contatore di un tipo da mostrare: quello dell'esercente emittente, altrimenti il primo di quel tipo. */
export function pickCounter(counters: CardCounter[], type: CounterType): CardCounter | undefined {
  const ofType = counters.filter((c) => c.type === type);
  return ofType.find((c) => c.main) ?? ofType[0];
}

/** Contatore con cui si misurano le soglie premio della card (stesso tipo, quello dell'esercente emittente). */
export function thresholdCounter(card: Card): CardCounter | undefined {
  return card.thresholds ? pickCounter(card.counters ?? [], card.thresholds.type) : undefined;
}

/**
 * Valore da confrontare con le soglie; sulla postpagata il saldo euro è negativo (speso da saldare), quindi conta il
 * valore assoluto. Undefined se la card non ha soglie o non ha il contatore di quel tipo.
 */
export function thresholdProgress(card: Card): number | undefined {
  const counter = thresholdCounter(card);
  if (!counter) return undefined;
  const value = counter.type === 'euro' && card.kind === 'postpaid' ? Math.abs(counter.amount) : counter.amount;
  return Math.max(0, value);
}

/** Soglia più alta raggiunta finora (le soglie sono dalla più bassa); undefined se nessuna è raggiunta. */
export function highestReachedThreshold(card: Card): CardThreshold | undefined {
  const current = thresholdProgress(card);
  if (current === undefined || !card.thresholds) return undefined;
  return card.thresholds.items.filter((s) => current >= s.amount).at(-1);
}

/**
 * Movimenti da mostrare: quelli del contatore euro e/o punti che la card ha (con entrambi il cliente sceglie quali
 * vedere); senza nessuno dei due (solo standard/sconto) elenco vuoto = tutti i movimenti, cioè gli scontrini.
 */
export function movementCounters(card: Card): MovementCounter[] {
  const counters = card.counters ?? [];
  return (['euro', 'points'] as const).filter((type) => counters.some((c) => c.type === type));
}

/** Tipo contatore del gestionale per il filtro dei movimenti. */
const TIPO_CONTATORE: Record<MovementCounter, number> = { euro: 1, points: 4 };

/**
 * Saldo mostrato sulla card: il credito/saldo in euro se la card ha un contatore euro (prepagata, postpagata,
 * autoricarica), altrimenti i punti; nessun saldo se ha solo il contatore standard (ed eventualmente lo sconto).
 */
function pickBalance(counters: CardCounter[]): CardBalance | undefined {
  const euro = pickCounter(counters, 'euro');
  if (euro) return { type: 'euro', amount: euro.amount };
  const points = pickCounter(counters, 'points');
  return points ? { type: 'points', amount: points.amount } : undefined;
}

/** Tipo del gestionale (CARDDETTAGLIO) -> tipo dell'app; una card senza dettaglio è standard. */
const KINDS: Record<string, CardKind> = {
  prepagata: 'prepaid',
  postpagata: 'postpaid',
  standard: 'standard',
};

function cardKind(tipo: string | null): CardKind {
  return KINDS[tipo?.trim().toLowerCase() ?? ''] ?? 'standard';
}

const DISCOUNT_TYPES: Record<string, CardDiscount['type']> = {
  percentuale: 'percent',
  valore: 'value',
  tipologia: 'category',
};

/** Sconto del dettaglio della card; una percentuale o un valore a 0 non fanno sconti. */
function toDiscount(c: ApiCard): CardDiscount | undefined {
  const type = DISCOUNT_TYPES[c.tipoSconto?.trim().toLowerCase() ?? ''];
  if (!type) return undefined;
  const amount = c.sconto ?? 0;
  if (type !== 'category' && amount <= 0) return undefined;
  return { type, amount };
}

/** Soglie del premio della card; assenti se non è attiva nessuna soglia o non ce ne sono di valide. */
function toThresholds(c: ApiCard): CardThresholds | undefined {
  const unit = c.soglieIn?.trim().toLowerCase();
  const type = unit === 'punti' ? 'points' : unit === 'euro' ? 'euro' : undefined;
  if (!type) return undefined;
  const items = (c.soglie ?? [])
    .filter((s) => s.soglia > 0)
    .map((s) => ({ amount: s.soglia, reward: s.buono?.trim() || undefined }))
    .sort((a, b) => a.amount - b.amount);
  return items.length > 0 ? { type, items } : undefined;
}

function toCard(c: ApiCard, accountKey: string, fallbackIssuer: string): Card {
  const issuerName = c.emittente?.ragioneSociale?.trim() || fallbackIssuer;
  const kind = cardKind(c.tipo);
  const counters = c.contatori.map((k) => toCounter(k, issuerName));
  return {
    id: String(c.idCard),
    accountKey,
    kind,
    code: c.codice,
    balance: pickBalance(counters),
    issuer: { name: issuerName, city: c.emittente?.citta ?? undefined },
    blocked: c.bloccata,
    reference: c.riferimento ?? undefined,
    note: c.note ?? undefined,
    color: c.colore?.trim() || undefined,
    masterCode: c.codiceMaster ?? undefined,
    createdAt: c.dataInserimento,
    lastUsedAt: c.ultimoUtilizzo?.slice(0, 8),
    counters,
    discount: toDiscount(c),
    thresholds: toThresholds(c),
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
  /** standard, euro, punti o sconto. */
  contatore: string;
  descrizione: string | null;
  documento: string | null;
  totaleDocumento?: number;
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

/**
 * Pagina di movimenti di una card di un account (dal più recente); `page` parte da 1.
 * Con `counter` solo i movimenti di quel contatore (euro o punti), altrimenti tutti.
 */
export async function fetchMovements(
  accountKey: string,
  cardId: string,
  page: number,
  counter?: MovementCounter,
): Promise<{ movements: CardMovement[]; total: number }> {
  const res = await cloudAuthedPostFor<ApiMovimentiResponse>(accountKey, '/AUC/MovimentiCardCliente', {
    idCard: Number(cardId),
    pagina: page,
    dimensione: MOVEMENTS_PAGE_SIZE,
    ...(counter ? { tipoContatore: TIPO_CONTATORE[counter] } : null),
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
      documentTotal: m.totaleDocumento ? m.totaleDocumento : undefined,
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
