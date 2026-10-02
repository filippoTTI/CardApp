export type CardBalance =
  | { type: 'points'; amount: number }
  | { type: 'euro'; amount: number };

/** Prepagata (si ricarica e si consuma), postpagata (si paga a consuntivo), standard (fedeltà) o gift card (regalo). */
export type CardKind = 'prepaid' | 'postpaid' | 'standard' | 'gift';

export type Card = {
  id: string;
  kind: CardKind;
  /** Codice alfanumerico maiuscolo di 6 caratteri, assegnato dal backend: è anche ciò che viene codificato nel QR. */
  code: string;
  /** Saldo in punti o in euro, a seconda di come è stata creata la card. */
  balance: CardBalance;
};
