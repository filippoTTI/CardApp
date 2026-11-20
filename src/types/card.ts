export type CardBalance =
  | { type: 'points'; amount: number }
  | { type: 'euro'; amount: number };

/** Prepagata (si ricarica e si consuma), postpagata (si paga a consuntivo) o standard (fedeltà, anche con autoricarica). */
export type CardKind = 'prepaid' | 'postpaid' | 'standard';

/** Sconto della card (dal suo dettaglio): percentuale, importo in euro o per tipologia di prodotto (senza un valore unico). */
export type CardDiscount = { type: 'percent' | 'value' | 'category'; amount: number };

export type Card = {
  id: string;
  /** Account salvato (esercente + email) da cui arriva la card. */
  accountKey?: string;
  kind: CardKind;
  /** Codice alfanumerico maiuscolo di 6 caratteri, assegnato dal backend: è anche ciò che viene codificato nel QR. */
  code: string;
  /** Saldo mostrato sulla card: euro se la card ha un contatore euro, altrimenti punti; assente se ha solo il contatore standard. */
  balance?: CardBalance;
  /** Dati reali dal backend (assenti nelle card di prova). */
  issuer?: { name: string; city?: string };
  blocked?: boolean;
  reference?: string;
  note?: string;
  /** Colore della card scelto dall'esercente (esadecimale, es. "#1f4634"); assente se non impostato. */
  color?: string;
  /** Codice della card master (i movimenti sono sui suoi contatori). */
  masterCode?: string;
  /** Date in formato yyyyMMdd. */
  createdAt?: string;
  lastUsedAt?: string;
  /** Tutti i contatori della card (standard, euro, punti, sconto; per card, esercente o circuito). */
  counters?: CardCounter[];
  /** Sconto attivo della card; assente se non fa sconti. */
  discount?: CardDiscount;
  /** Soglie del premio (in punti o in euro), dalla più bassa; assenti se la card non ne ha. */
  thresholds?: CardThresholds;
};

/** Una soglia del premio: raggiunto `amount` il cliente può riscattare il buono in cassa. */
export type CardThreshold = { amount: number; reward?: string };

export type CardThresholds = { type: 'points' | 'euro'; items: CardThreshold[] };

/** Contatori di cui si mostrano i movimenti separatamente (selettore sotto "Movimenti"). */
export type MovementCounter = 'euro' | 'points';

/**
 * Tipo di contatore come lo definisce il gestionale (0 standard, 1 euro, 4 punti, 5 sconto). Lo standard non ha saldo
 * e lo sconto resta a 0 (il valore sta in `Card.discount`): nessuno dei due va mostrato come saldo.
 */
export type CounterType = 'standard' | 'euro' | 'points' | 'discount' | 'other';

export type CardCounter = {
  /** Esercente o circuito a cui è associato il contatore. */
  name: string;
  type: CounterType;
  amount: number;
  /** Soglia impostata sul contatore (per i punti la prima soglia del premio); si mostra come "Soglia". */
  limit?: number;
  /** Contatore dell'esercente che ha emesso la card. */
  main: boolean;
};

/** Movimento di una card: ricarica, spesa o accredito (es. punti). */
export type CardMovement = {
  id: number;
  kind: 'recharge' | 'expense' | 'credit';
  /** Data e ora locali, formato yyyy-MM-ddTHH:mm:ss. */
  dateTime: string;
  /** Variazione del contatore, con segno. */
  amount: number;
  balanceAfter: number;
  counter: CounterType;
  description?: string;
  document?: string;
  /** Totale del documento (scontrino) in euro; assente se il movimento non ha un documento con importo. */
  documentTotal?: number;
  merchant: string;
  circuit?: string;
  /** Codice della card che ha eseguito il movimento sul conto di una card master. */
  slaveCode?: string;
  lines: { description?: string; unit?: string; quantity: number; total: number }[];
};
