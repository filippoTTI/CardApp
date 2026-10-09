import { useCallback, useState } from 'react';

/**
 * Errori dei campi di un modulo: `fail` mostra un messaggio sotto un campo e lo fa scuotere (anche se il messaggio è lo stesso
 * di prima), `clear` lo toglie appena l'utente corregge. `shakeFor` va passato come `shakeKey` al campo.
 */
export function useFormErrors<F extends string>() {
  const [errors, setErrors] = useState<Partial<Record<F, string>>>({});
  const [shakeKey, setShakeKey] = useState(0);

  const fail = useCallback((field: F, message: string) => {
    setErrors({ [field]: message } as Partial<Record<F, string>>);
    setShakeKey((k) => k + 1);
  }, []);

  const clear = useCallback((field: F) => {
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  }, []);

  const shakeFor = (field: F) => (errors[field] ? shakeKey : undefined);

  return { errors, fail, clear, shakeFor };
}
