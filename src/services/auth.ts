/**
 * Accesso con email e password.
 * TODO: sostituire con la chiamata al backend.
 * Provvisorio, solo per provare la scossa di errore: con la password "errata" il login fallisce, con qualsiasi altra riesce.
 */
export async function signInWithPassword(_email: string, password: string): Promise<boolean> {
  return password !== 'errata';
}
