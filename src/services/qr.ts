import type { Card, CardThreshold } from '@/types/card';

/**
 * Contenuto da codificare nel QR di una card.
 * TODO: se il lettore/backend richiede un formato diverso (URL, prefisso, firma…) va cambiato solo qui.
 */
export function buildQrPayload(card: Pick<Card, 'code'>): string {
  return card.code;
}

/**
 * Contenuto del QR di un premio raggiunto: `<codice card>-<valore della soglia>` (es. `DSEOZVPTC5-4`, `ABC123-10.5`).
 * La soglia si identifica dal suo valore (il backend non espone un id stabile). Niente `:` come separatore: la
 * fotocamera dell'iPhone legge `CODICE:4` come uno schema URI sconosciuto e lo scarta. Il formato va cambiato solo qui.
 */
export function buildThresholdQrPayload(card: Pick<Card, 'code'>, threshold: Pick<CardThreshold, 'amount'>): string {
  return `${card.code}-${threshold.amount}`;
}
