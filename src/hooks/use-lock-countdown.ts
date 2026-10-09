import { useCallback, useEffect, useState } from 'react';

import { getLockUntil } from '@/services/app-lock';

/**
 * Blocco dei tentativi del codice di sblocco dopo troppi errori: legge all'avvio se è già in corso (app riaperta durante il
 * blocco), conta i secondi rimanenti e si azzera da solo alla scadenza. `start` va chiamato quando la verifica restituisce un blocco.
 */
export function useLockCountdown() {
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    getLockUntil().then((until) => {
      if (active && until > 0) {
        setNow(Date.now());
        setLockedUntil(until);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const timer = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) setLockedUntil(0);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const start = useCallback((until: number) => {
    setNow(Date.now());
    setLockedUntil(until);
  }, []);

  /** Secondi al termine del blocco (0 = nessun blocco). */
  const remaining = lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;

  return { remaining, start };
}

/** "Troppi tentativi. Riprova tra 2 min" / "... tra 25 s". */
export function lockMessage(seconds: number): string {
  return `Troppi tentativi. Riprova tra ${seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`}`;
}
