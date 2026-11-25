import { useEffect, useState } from 'react';

import { listAccounts } from '@/services/accounts';
import { errorMessage } from '@/services/api';
import { fetchEsercente, type EsercenteInfo } from '@/services/auth';

/**
 * Esercente delle schermate di accesso. Con un link/QR (`cod`) il codice non viene mai mostrato e il suo nome, preso dal server,
 * va nel sottotitolo. Senza link il campo del codice compare sempre (`always`, es. nuovo account) oppure solo al primo avvio,
 * quando sul telefono non c'è nessun account salvato (`first-run`).
 */
export function useEsercenteCode(cod: string | undefined, mode: 'always' | 'first-run') {
  const [linkName, setLinkName] = useState<string>();
  const [linkError, setLinkError] = useState<string>();
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(mode === 'always' ? false : null);
  const [code, setCode] = useState('');
  const [name, setName] = useState<string>();
  const [info, setInfo] = useState<EsercenteInfo>();

  useEffect(() => {
    if (mode === 'always') return;
    let active = true;
    listAccounts().then((l) => {
      if (active) setHasAccounts(l.length > 0);
    });
    return () => {
      active = false;
    };
  }, [mode]);

  useEffect(() => {
    if (!cod) return;
    let active = true;
    fetchEsercente(cod)
      .then((e) => {
        if (active) {
          setLinkName(e.ragioneSociale);
          setInfo(e);
        }
      })
      .catch((e) => {
        if (active) setLinkError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [cod]);

  // codice digitato o scelto e già verificato: servono i dati dell'esercente (modalità scuola, domini)
  const typed = !cod && name !== undefined ? code : undefined;
  useEffect(() => {
    if (!typed) return;
    let active = true;
    fetchEsercente(typed)
      .then((e) => {
        if (active) setInfo(e);
      })
      .catch(() => {
        // le informazioni sono facoltative: senza, la registrazione funziona come sempre
      });
    return () => {
      active = false;
    };
  }, [typed]);

  const needsCode = !cod && hasAccounts === false;

  return {
    /** Nome dell'esercente del link/QR, quando arriva dal server. */
    linkName,
    /** Errore nella lettura dell'esercente del link/QR. */
    linkError,
    /** Dati dell'esercente (modalità scuola e domini ammessi), se già letti dal server per il codice in uso. */
    info: info && info.codEsercente.toUpperCase() === (cod ?? code).trim().toUpperCase() ? info : undefined,
    /** Il campo del codice va mostrato. */
    needsCode,
    /** Codice da usare per le chiamate (quello del link o quello digitato). */
    codEsercente: cod ?? code,
    /** False se il campo del codice è mostrato ma non contiene ancora un codice verificato. */
    codeValid: !needsCode || name !== undefined,
    code,
    name,
    setCode: (c: string, n?: string) => {
      setCode(c);
      setName(n);
    },
  };
}

export const MISSING_CODE_MESSAGE = 'Inserisci un codice esercente valido o scansiona il QR';
