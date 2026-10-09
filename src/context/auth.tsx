import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { accountKey } from '@/services/accounts';
import { deleteAccountOnServer, forgetAccount, listAccounts, refreshSession, restoreSession, signOutRemote, switchAccount as switchAccountRemote, type AuthCliente } from '@/services/auth';

type AuthContextValue = {
  isSignedIn: boolean;
  /** True finché si controlla se esiste una sessione salvata (all'avvio). */
  isRestoring: boolean;
  /** Cliente collegato alla sessione corrente. */
  user: AuthCliente | null;
  /** Aumenta quando l'elenco degli account salvati cambia (rimozione, eliminazione). */
  accountsVersion: number;
  /** True dopo il primo login finché l'utente non ha visto la proposta passkey. */
  shouldOfferPasskey: boolean;
  signIn: (options?: { skipPasskeyOffer?: boolean; cliente?: AuthCliente }) => void;
  /** Chiude la sessione senza rimuovere nulla dal telefono (usato dal reset dell'app). */
  signOut: () => void;
  /** Esce dall'account in uso: lo rimuove dal telefono e passa al primo degli altri account salvati (login solo se non ne restano). */
  leaveAccount: () => Promise<void>;
  /** Passa a un altro account salvato (chiave esercente + email). Solleva ApiError se l'accesso non riesce. */
  switchAccount: (key: string) => Promise<void>;
  /** Dimentica un account salvato; se è quello in uso equivale a uscire. */
  removeAccount: (key: string) => Promise<void>;
  /** Elimina l'account sul server e chiude la sessione. Solleva ApiError se non riesce. */
  deleteAccount: (key: string, password: string) => Promise<void>;
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
  const [accountsVersion, setAccountsVersion] = useState(0);
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
  const switchAccount = useCallback(async (key: string) => {
    const s = await switchAccountRemote(key);
    setUser(s.cliente);
  }, []);
  /** Rimuove dal telefono l'account in uso; se ne restano altri passa al primo, altrimenti torna al login. */
  const leaveActive = useCallback(async (key: string) => {
    await forgetAccount(key);
    setAccountsVersion((v) => v + 1);
    const rest = await listAccounts();
    if (rest.length > 0) {
      try {
        const s = await switchAccountRemote(accountKey(rest[0]));
        setUser(s.cliente);
        return;
      } catch {
        // l'altro account non si apre (es. password cambiata): si torna al login, gli account restano salvati
      }
    }
    setShouldOfferPasskey(false);
    setUser(null);
    setIsSignedIn(false);
  }, []);
  const leaveAccount = useCallback(async () => {
    if (user) await leaveActive(user.accountKey);
  }, [user, leaveActive]);
  const removeAccount = useCallback(
    async (key: string) => {
      if (user?.accountKey === key) {
        await leaveActive(key);
        return;
      }
      await forgetAccount(key);
      setAccountsVersion((v) => v + 1);
    },
    [user, leaveActive],
  );
  const deleteAccount = useCallback(
    async (key: string, password: string) => {
      // prima il server: se rifiuta (password errata, card ancora assegnate) l'account resta com'e'
      await deleteAccountOnServer(key, password);
      setPasskeyOffered(false);
      await removeAccount(key);
    },
    [removeAccount],
  );
  const dismissPasskeyOffer = useCallback(() => {
    setShouldOfferPasskey(false);
    setPasskeyOffered(true);
  }, []);

  const value = useMemo(
    () => ({ isSignedIn, isRestoring, user, accountsVersion, shouldOfferPasskey, signIn, signOut, leaveAccount, switchAccount, removeAccount, deleteAccount, dismissPasskeyOffer }),
    [isSignedIn, isRestoring, user, accountsVersion, shouldOfferPasskey, signIn, signOut, leaveAccount, switchAccount, removeAccount, deleteAccount, dismissPasskeyOffer],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve essere usato dentro AuthProvider');
  return ctx;
}
