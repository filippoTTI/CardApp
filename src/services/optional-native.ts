/**
 * Caricamento "morbido" di un modulo con codice nativo: se la build installata non lo include ancora (dev client da
 * ricompilare) la funzione che lo usa risulta semplicemente non disponibile, invece di far chiudere l'app all'avvio.
 * `load` deve contenere il `require` con il nome letterale del modulo, così il bundler lo trova.
 */
export function optionalNative<T>(name: string, load: () => T): () => T | null {
  let cached: T | null | undefined;
  return () => {
    if (cached === undefined) {
      try {
        cached = load();
      } catch (e) {
        console.warn(`[${name}] modulo nativo non disponibile`, e);
        cached = null;
      }
    }
    return cached;
  };
}
