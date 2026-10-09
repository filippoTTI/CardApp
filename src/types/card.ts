export type CardBalance =
  | { type: 'points'; amount: number }
  | { type: 'euro'; amount: number };

/** Prepagata (si ricarica e si consuma), postpagata (si paga a consuntivo), standard (fedeltà) o gift card (regalo). */
export type CardKind = 'prepaid' | 'postpaid' | 'standard' | 'gift';

export type Card = {
  id: string;
  /** Account salvato (esercente + email) da cui arriva la card. */
  accountKey?: string;
  kind: CardKind;
  /** Codice alfanumerico maiuscolo di 6 caratteri, assegnato dal backend: è anche ciò che viene codificato nel QR. */
  code: string;
  /** Saldo in punti o in euro; assente per le card senza saldo (solo contatore standard). */
  balance?: CardBalance;
  /** Dati reali dal backend (assenti nelle card di prova). */
  issuer?: { name: string; city?: string };
  blocked?: boolean;
  reference?: string;
  note?: string;
  /** Dati aggiuntivi associati alla card dall'esercente. */
  data?: string;
  /** Codice della card master (i movimenti sono sui suoi contatori). */
  masterCode?: string;
  /** Date in formato yyyyMMdd. */
  createdAt?: string;
  lastUsedAt?: string;
  /** Tutti i contatori della card (punti o saldo, per esercente o circuito). */
  counters?: CardCounter[];
};

/** Tipo di contatore come lo definisce il backend: standard (nessun saldo), euro, punti, sconto. */
export type CounterType = 'standard' | 'euro' | 'points' | 'discount' | 'other';

export type CardCounter = {
  /** Esercente o circuito a cui è associato il contatore. */
  name: string;
  type: CounterType;
  amount: number;
  limit?: number;
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
  merchant: string;
  circuit?: string;
  /** Codice della card che ha eseguito il movimento sul conto di una card master. */
  slaveCode?: string;
  lines: { description?: string; unit?: string; quantity: number; total: number }[];
};
