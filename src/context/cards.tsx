import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Card } from '@/types/card';

type CardsContextValue = {
  cards: Card[];
  /** TODO: SOLO PER TEST GRAFICI. Assegna le 4 card di prova. */
  assignSampleCards: () => void;
  /** TODO: SOLO PER TEST GRAFICI. Rimuove tutte le card. */
  clearCards: () => void;
};

const CardsContext = createContext<CardsContextValue | null>(null);

// TODO: dati finti. Le card non le aggiunge l'utente dall'app: arrivano dal backend / vengono assegnate.
const SAMPLE_CARDS: Card[] = [
  { id: '1', kind: 'prepaid', code: 'A7K9Q2', balance: { type: 'points', amount: 1250 } },
  { id: '2', kind: 'postpaid', code: 'M4X8TB', balance: { type: 'euro', amount: 37.5 } },
  { id: '3', kind: 'standard', code: 'K2P7VD', balance: { type: 'points', amount: 480 } },
  { id: '4', kind: 'gift', code: 'G9R4WN', balance: { type: 'euro', amount: 50 } },
];

export function CardsProvider({ children }: { children: ReactNode }) {
  // Parte senza card; i due metodi sotto servono solo ai test grafici (tasti provvisori nella home).
  const [cards, setCards] = useState<Card[]>([]);
  const assignSampleCards = useCallback(() => setCards(SAMPLE_CARDS), []);
  const clearCards = useCallback(() => setCards([]), []);
  const value = useMemo(() => ({ cards, assignSampleCards, clearCards }), [cards, assignSampleCards, clearCards]);
  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

export function useCards() {
  const ctx = useContext(CardsContext);
  if (!ctx) throw new Error('useCards deve essere usato dentro CardsProvider');
  return ctx;
}
