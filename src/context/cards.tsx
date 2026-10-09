import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from '@/context/auth';
import { accountKey } from '@/services/accounts';
import { listAccounts, type SavedAccount } from '@/services/auth';
import { fetchCards, setCardBlocked } from '@/services/cards';
import type { Card } from '@/types/card';

/** Card di un account salvato (uno per esercente e email). */
export type AccountCards = {
  key: string;
  ragioneSociale: string;
  email: string;
  cards: Card[];
  /** True finché non arriva la prima risposta per questo account. */
  loading: boolean;
  /** Messaggio se il caricamento delle card di questo account è fallito. */
  error?: string;
};

type CardsContextValue = {
  /** Account salvati, ognuno con le sue card; l'account in uso è il primo. */
  accounts: AccountCards[];
  /** Tutte le card di tutti gli account. */
  cards: Card[];
  /** True finché non arriva la prima risposta del backend dopo il login (per l'account in uso). */
  loading: boolean;
  /** Ricarica le card di tutti gli account dal backend. */
  reload: () => Promise<void>;
  /** Blocca o sblocca una card sul server e aggiorna l'elenco; ritorna un messaggio se era già nello stato richiesto. */
  setBlocked: (cardId: string, blocked: boolean) => Promise<string | undefined>;
};

const CardsContext = createContext<CardsContextValue | null>(null);

function toGroup(a: SavedAccount): AccountCards {
  return { key: accountKey(a), ragioneSociale: a.ragioneSociale, email: a.email, cards: [], loading: true };
}

/** Account in uso per primo, gli altri nell'ordine in cui sono stati aggiunti. */
function ordered(accounts: SavedAccount[], activeKey: string | undefined): SavedAccount[] {
  return [...accounts].sort((a, b) => Number(accountKey(b) === activeKey) - Number(accountKey(a) === activeKey));
}

export function CardsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, user, accountsVersion } = useAuth();
  const activeKey = user?.accountKey;
  const [accounts, setAccounts] = useState<AccountCards[]>([]);

  /** Carica le card di ogni account salvato in parallelo; ogni gruppo si aggiorna appena la sua risposta arriva. */
  const loadAll = useCallback(
    async (isActive: () => boolean, resetFirst: boolean) => {
      const saved = ordered(await listAccounts(), activeKey);
      if (!isActive()) return;
      if (resetFirst) setAccounts(saved.map(toGroup));
      await Promise.all(
        saved.map(async (acc) => {
          const key = accountKey(acc);
          let patch: Partial<AccountCards>;
          try {
            patch = { cards: await fetchCards(key, acc.ragioneSociale), error: undefined, loading: false };
          } catch (e) {
            patch = { error: e instanceof Error ? e.message : 'Errore imprevisto', loading: false };
          }
          if (!isActive()) return;
          setAccounts((prev) => {
            // se nel frattempo l'elenco è cambiato (account aggiunto o rimosso) si lavora su quello aggiornato
            const base = prev.some((g) => g.key === key) ? prev : [...prev, toGroup(acc)];
            return base.map((g) => (g.key === key ? { ...g, ...patch } : g));
          });
        }),
      );
    },
    [activeKey],
  );

  // Le card arrivano dal backend appena si è dentro, a ogni cambio di account in uso o dell'elenco degli account;
  // all'uscita si svuota tutto.
  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lo stato si aggiorna dopo le risposte di rete, non in modo sincrono
    void loadAll(() => active, true);
    return () => {
      active = false;
      setAccounts([]);
    };
  }, [isSignedIn, loadAll, accountsVersion]);

  const reload = useCallback(async () => {
    await loadAll(() => true, false);
  }, [loadAll]);

  // Al ritorno in primo piano i dati si aggiornano da soli.
  useEffect(() => {
    if (!isSignedIn) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void reload();
    });
    return () => sub.remove();
  }, [isSignedIn, reload]);

  const cards = useMemo(() => accounts.flatMap((g) => g.cards), [accounts]);

  const setBlocked = useCallback(async (cardId: string, blocked: boolean) => {
    const key = cards.find((c) => c.id === cardId)?.accountKey;
    if (!key) throw new Error('Card non trovata');
    const res = await setCardBlocked(key, cardId, blocked);
    setAccounts((prev) => prev.map((g) => ({ ...g, cards: g.cards.map((c) => (c.id === cardId ? { ...c, blocked: res.blocked } : c)) })));
    return res.message;
  }, [cards]);

  const loading = accounts.length === 0 || (accounts.find((g) => g.key === activeKey) ?? accounts[0]).loading;

  const value = useMemo(() => ({ accounts, cards, loading, reload, setBlocked }), [accounts, cards, loading, reload, setBlocked]);
  return <CardsContext.Provider value={value}>{children}</CardsContext.Provider>;
}

export function useCards() {
  const ctx = useContext(CardsContext);
  if (!ctx) throw new Error('useCards deve essere usato dentro CardsProvider');
  return ctx;
}
