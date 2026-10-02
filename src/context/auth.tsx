import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { deleteAccountRemote, refreshSession, restoreSession, signOutRemote, type AuthCliente } from '@/services/auth';

type AuthContextValue = {
  isSignedIn: boolean;
  /** True finché si controlla se esiste una sessione salvata (all'avvio). */
  isRestoring: boolean;
  /** Cliente collegato alla sessione corrente. */
  user: AuthCliente | null;
  /** True dopo il primo login finché l'utente non ha visto la proposta passkey. */
  shouldOfferPasskey: boolean;
  signIn: (options?: { skipPasskeyOffer?: boolean; cliente?: AuthCliente }) => void;
  signOut: () => void;
  /** Elimina l'account sul server e chiude la sessione. Solleva ApiError se non riesce. */
  deleteAccount: () => Promise<void>;
  dismissPasskeyOffer: () => void;
};

/** Ogni quanto si rinnova la sessione mentre l'app è aperta (la scadenza lato server è di 5 minuti). */
const KEEP_ALIVE_MS = 2 * 60 * 1000;

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [user, setUser] = useState<AuthCliente | null>(null);
  const [shouldOfferPasskey, setShouldOfferPasskey] = useState(false);
  // TODO: persistere (es. expo-secure-store) legato all'utente reale.
  const [passkeyOffered, setPasskeyOffered] = useState(false);

  useEffect(() => {
    let active = true;
    restoreSession().then((s) => {
      if (!active) return;
      if (s) {
        setUser(s.cliente);
        setPasskeyOffered(true); // chi riapre l'app con una sessione salvata ha già superato il primo accesso
        setIsSignedIn(true);
      }
      setIsRestoring(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Con l'app aperta la sessione si rinnova da sola; se resta in background oltre la scadenza, al ritorno si deve riaccedere.
  useEffect(() => {
    if (!isSignedIn) return;
    const check = async () => {
      const r = await refreshSession();
      if (r.status === 'expired') {
        setShouldOfferPasskey(false);
        setUser(null);
        setIsSignedIn(false);
      }
    };
    const timer = setInterval(check, KEEP_ALIVE_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [isSignedIn]);

  const signIn = useCallback(
    (options?: { skipPasskeyOffer?: boolean; cliente?: AuthCliente }) => {
      setShouldOfferPasskey(!passkeyOffered && !options?.skipPasskeyOffer);
      setUser(options?.cliente ?? null);
      setIsSignedIn(true);
    },
    [passkeyOffered],
  );
  const signOut = useCallback(() => {
    void signOutRemote();
    setShouldOfferPasskey(false);
    setUser(null);
    setIsSignedIn(false);
  }, []);
  const deleteAccount = useCallback(async () => {
    await deleteAccountRemote();
    setShouldOfferPasskey(false);
    setPasskeyOffered(false);
    setUser(null);
    setIsSignedIn(false);
  }, []);
  const dismissPasskeyOffer = useCallback(() => {
    setShouldOfferPasskey(false);
    setPasskeyOffered(true);
  }, []);

  const value = useMemo(
    () => ({ isSignedIn, isRestoring, user, shouldOfferPasskey, signIn, signOut, deleteAccount, dismissPasskeyOffer }),
    [isSignedIn, isRestoring, user, shouldOfferPasskey, signIn, signOut, deleteAccount, dismissPasskeyOffer],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return ctx;
}
