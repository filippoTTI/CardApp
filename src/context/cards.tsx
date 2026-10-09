import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth';
import { accountKey, listAccounts, type SavedAccount } from '@/services/accounts';
import { errorMessage } from '@/services/api';
import { fetchCards, setCardBlocked } from '@/services/cards';
import type { Card } from '@/types/card';

/** Card di un account salvato (uno per esercente e email). */
export type AccountCards = {
  key: string;
  ragioneSociale: string;
  email: string;
  cards: Card[];
  /** True finché non arriva la prima risposta per questo account (gli aggiornamenti successivi avvengono in silenzio). */
  loading: boolean;
  /** Messaggio se l'ultimo caricamento delle card di questo account è fallito. */
  error?: string;
};

type CardsContextValue = {
  /** Account salvati, ognuno con le sue card; l'account in uso è il primo. */
  accounts: AccountCards[];
  /** Tutte le card di tutti gli account. */
  cards: Card[];
  /** True finché non arriva la prima risposta del backend per l'account in uso. */
  loading: boolean;
  /** Ricarica le card di tutti gli account dal backend, senza svuotare quelle già mostrate. */
  reload: () => Promise<void>;
  /** Blocca o sblocca una card sul server e aggiorna l'elenco; ritorna un messaggio se era già nello stato richiesto. */
  setBlocked: (cardId: string, blocked: boolean) => Promise<string | undefined>;
};

const CardsContext = createContext<CardsContextValue | null>(null);

function toGroup(a: SavedAccount): AccountCards {
  return { key: accountKey(a), ragioneSociale: a.ragioneSociale, email: a.email, cards: [], loading: true };
}

export function CardsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, user, accountsVersion } = useAuth();
  const activeKey = user?.accountKey;
  const [groups, setGroups] = useState<AccountCards[]>([]);
  const signedIn = useRef(isSignedIn);

  useEffect(() => {
    signedIn.current = isSignedIn;
  }, [isSignedIn]);

  /**
   * Allinea i gruppi agli account salvati (mantenendo le card già caricate) e poi aggiorna ogni account in parallelo:
   * ogni gruppo cambia appena arriva la sua risposta. Nessun gruppo già caricato torna allo stato di caricamento.
   */
  const loadAll = useCallback(async (isActive: () => boolean) => {
    const saved = await listAccounts();
    if (!isActive()) return;
    setGroups((prev) => saved.map((a) => prev.find((g) => g.key === accountKey(a)) ?? toGroup(a)));
    await Promise.all(
      saved.map(async (acc) => {
        const key = accountKey(acc);
        let patch: Partial<AccountCards>;
        try {
          patch = { cards: await fetchCards(key, acc.ragioneSociale), error: undefined, loading: false };
        } catch (e) {
          // le card già mostrate restano: l'errore conta solo se non c'è nulla da mostrare
          patch = { error: errorMessage(e), loading: false };
        }
        if (!isActive()) return;
        setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));
      }),
    );
  }, []);

  // Le card arrivano appena si è dentro e si aggiornano in silenzio a ogni cambio di account in uso o dell'elenco degli account.
  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lo stato si aggiorna dopo le risposte di rete, non in modo sincrono
    void loadAll(() => active);
    return () => {
      active = false;
    };
  }, [isSignedIn, loadAll, accountsVersion, activeKey]);

  // All'uscita si svuota tutto.
  useEffect(() => {
    if (!isSignedIn) return;
    return () => setGroups([]);
  }, [isSignedIn]);

  const reload = useCallback(() => loadAll(() => signedIn.current), [loadAll]);

  // Al ritorno in primo piano i dati si aggiornano da soli.
  useEffect(() => {
    if (!isSignedIn) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [isSignedIn, reload]);

  // Account in uso per primo, gli altri nell'ordine in cui sono stati aggiunti: il riordino è immediato al cambio account.
  const accounts = useMemo(
    () => [...groups].sort((a, b) => Number(b.key === activeKey) - Number(a.key === activeKey)),
    [groups, activeKey],
  );
  const cards = useMemo(() => accounts.flatMap((g) => g.cards), [accounts]);

  const setBlocked = useCallback(
    async (cardId: string, blocked: boolean) => {
      const key = cards.find((c) => c.id === cardId)?.accountKey;
      if (!key) throw new Error('Card non trovata');
      const res = await setCardBlocked(key, cardId, blocked);
      setGroups((prev) => prev.map((g) => ({ ...g, cards: g.cards.map((c) => (c.id === cardId ? { ...c, blocked: res.blocked } : c)) })));
      return res.message;
    },
    [cards],
  );

  const loading = accounts.length === 0 || accounts[0].loading;

  const value = useMemo(() => ({ accounts, cards, loading, reload, setBlocked }), [accounts, cards, loading, reload, setBlocked]);
  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

export function useCards() {
  const ctx = useContext(CardsContext);
  if (!ctx) throw new Error('useCards deve essere usato dentro CardsProvider');
  return ctx;
}
