/**
 * Accesso con Google.
 *
 * Richiede codice nativo: funziona nelle build di sviluppo e di produzione, non in Expo Go.
 * I client id non sono segreti. L'`idToken` ottenuto è verificato dal backend, che accetta
 * solo token emessi per uno dei client id elencati in `Auth:GoogleClientIds`.
 */
const WEB_CLIENT_ID = '904996924630-jqqiafb6539rkco7dobe9f5sv7ucsrj3.apps.googleusercontent.com';
const IOS_CLIENT_ID = '904996924630-644rl8clocqg40ud0fn18sgu67u19gf0.apps.googleusercontent.com';

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let loading: Promise<GoogleModule | null> | undefined;

/** Carica la libreria nativa una sola volta; null se non è disponibile (es. Expo Go). */
function loadModule(): Promise<GoogleModule | null> {
  loading ??= import('@react-native-google-signin/google-signin')
    .then((mod) => {
      // il token viene richiesto per il client Web: è quello che il backend si aspetta come audience
      mod.GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, iosClientId: IOS_CLIENT_ID });
      return mod;
    })
    .catch(() => null);
  return loading;
}

export type GoogleIdentity = { idToken: string; nome?: string; cognome?: string };

/** Errore da mostrare all'utente (libreria non disponibile o accesso non riuscito). */
export class GoogleSignInError extends Error {}

/** Apre l'accesso Google; ritorna null se l'utente annulla. */
export async function getGoogleIdentity(): Promise<GoogleIdentity | null> {
  const mod = await loadModule();
  if (!mod) {
    throw new GoogleSignInError("L'accesso con Google è disponibile solo nell'app installata (build di sviluppo o di produzione), non in Expo Go");
  }
  const { GoogleSignin, isErrorWithCode, statusCodes } = mod;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return null;
    const { idToken, user } = res.data;
    if (!idToken) throw new GoogleSignInError('Google non ha restituito il token di accesso');
    return { idToken, nome: user.givenName ?? undefined, cognome: user.familyName ?? undefined };
  } catch (e) {
    if (e instanceof GoogleSignInError) throw e;
    if (isErrorWithCode(e)) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS) return null;
      if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new GoogleSignInError('Google Play Services non disponibili su questo dispositivo');
    }
    throw new GoogleSignInError('Accesso con Google non riuscito');
  }
}
