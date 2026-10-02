import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type AuthContextValue = {
  isSignedIn: boolean;
  /** True dopo il primo login finché l'utente non ha visto la proposta passkey. */
  shouldOfferPasskey: boolean;
  /** TODO: sostituire con l'autenticazione reale. */
  signIn: (options?: { skipPasskeyOffer?: boolean }) => void;
  signOut: () => void;
  /** TODO: chiamare il backend per eliminare davvero account e dati. */
  deleteAccount: () => void;
  dismissPasskeyOffer: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [shouldOfferPasskey, setShouldOfferPasskey] = useState(false);
  // TODO: persistere (es. expo-secure-store) legato all'utente reale.
  const [passkeyOffered, setPasskeyOffered] = useState(false);

  const signIn = useCallback(
    (options?: { skipPasskeyOffer?: boolean }) => {
      setShouldOfferPasskey(!passkeyOffered && !options?.skipPasskeyOffer);
      setIsSignedIn(true);
    },
    [passkeyOffered],
  );
  const signOut = useCallback(() => {
    setShouldOfferPasskey(false);
    setIsSignedIn(false);
  }, []);
  const deleteAccount = useCallback(() => {
    // TODO: richiesta di eliminazione al backend + pulizia dei dati locali (sessione, passkey, card).
    setShouldOfferPasskey(false);
    setPasskeyOffered(false);
    setIsSignedIn(false);
  }, []);
  const dismissPasskeyOffer = useCallback(() => {
    setShouldOfferPasskey(false);
    setPasskeyOffered(true);
  }, []);

  const value = useMemo(
    () => ({ isSignedIn, shouldOfferPasskey, signIn, signOut, deleteAccount, dismissPasskeyOffer }),
    [isSignedIn, shouldOfferPasskey, signIn, signOut, deleteAccount, dismissPasskeyOffer],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return ctx;
}
