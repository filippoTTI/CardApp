import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth';
import { fetchCards, setCardBlocked } from '@/services/cards';
import type { Card } from '@/types/card';

type CardsContextValue = {
  cards: Card[];
  /** True finché non arriva la prima risposta del backend dopo il login. */
  loading: boolean;
  /** Messaggio se il caricamento delle card è fallito. */
  error?: string;
  /** Ricarica le card dal backend. */
  reload: () => Promise<void>;
  /** Blocca o sblocca una card sul server e aggiorna l'elenco; ritorna un messaggio se era già nello stato richiesto. */
  setBlocked: (cardId: string, blocked: boolean) => Promise<string | undefined>;
};

const CardsContext = createContext<CardsContextValue | null>(null);

export function CardsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setCards(await fetchCards());
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore imprevisto');
    }
  }, []);

  // Le card arrivano dal backend appena si è dentro; all'uscita si svuota tutto.
  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    fetchCards()
      .then((list) => {
        if (!active) return;
        setCards(list);
        setError(undefined);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Errore imprevisto');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      setCards([]);
      setError(undefined);
      setLoading(true);
    };
  }, [isSignedIn]);

  // Al ritorno in primo piano i dati si aggiornano da soli.
  useEffect(() => {
    if (!isSignedIn) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => sub.remove();
  }, [isSignedIn, reload]);

  const setBlocked = useCallback(async (cardId: string, blocked: boolean) => {
    const res = await setCardBlocked(cardId, blocked);
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, blocked: res.blocked } : c)));
    return res.message;
  }, []);

  const value = useMemo(() => ({ cards, loading, error, reload, setBlocked }), [cards, loading, error, reload, setBlocked]);
  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

export function useCards() {
  const ctx = useContext(CardsContext);
  if (!ctx) throw new Error('useCards deve essere usato dentro CardsProvider');
  return ctx;
}
