import type { Card } from '@/types/card';

/**
 * Contenuto da codificare nel QR di una card.
 * TODO: se il lettore/backend richiede un formato diverso (URL, prefisso, firma…) va cambiato solo qui.
 */
export function buildQrPayload(card: Pick<Card, 'code'>): string {
  return card.code;
}
