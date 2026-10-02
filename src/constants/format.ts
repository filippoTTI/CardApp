import type { CardKind } from '@/types/card';

export const numberFormat = new Intl.NumberFormat('it-IT');
export const euroFormat = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

/** Etichetta mostrata per ogni tipo di card. */
export const CARD_KIND_LABEL: Record<CardKind, string> = {
  prepaid: 'Prepagata',
  postpaid: 'Postpagata',
  standard: 'Standard',
  gift: 'Gift card',
};

/** yyyyMMdd -> dd/MM/yyyy; undefined se il valore non è una data valida. */
export function formatDate(value?: string): string | undefined {
  if (!value || value.length !== 8) return undefined;
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`;
}

/** yyyy-MM-ddTHH:mm:ss -> dd/MM/yyyy HH:mm */
export function formatDateTime(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : value;
}
