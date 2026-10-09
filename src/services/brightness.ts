import { optionalNative } from '@/services/optional-native';

/**
 * Luminosità al massimo mentre almeno un QR è mostrato; al termine torna al valore di prima.
 * Le variazioni sono graduali. Se la build installata non include il modulo nativo la funzione è semplicemente disattivata.
 */
type BrightnessModule = typeof import('expo-brightness');

const STEP_MS = 30;
const RAMP_UP_MS = 450;
const RAMP_DOWN_MS = 450;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const load = optionalNative('brightness', () => require('expo-brightness') as BrightnessModule);

/** Luminosità da ripristinare (letta prima di alzarla); undefined quando è tornata al valore originale. */
let saved: number | undefined;
let current = 0;
/** QR mostrati in questo momento. */
let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/** Porta la luminosità al valore `to` in `ms`, partendo da quella attuale (interrompe una variazione in corso). */
function rampTo(b: BrightnessModule, to: number, ms: number, onDone?: () => void) {
  clearInterval(timer);
  const from = current;
  const steps = Math.max(1, Math.round(ms / STEP_MS));
  let i = 0;
  timer = setInterval(() => {
    i += 1;
    const p = i / steps;
    const eased = p * (2 - p); // ease-out
    current = from + (to - from) * Math.min(eased, 1);
    b.setBrightnessAsync(current).catch((e) => console.warn('[brightness] impossibile impostare', e));
    if (i >= steps) {
      clearInterval(timer);
      onDone?.();
    }
  }, STEP_MS);
}

export async function boostBrightness(): Promise<void> {
  users += 1;
  if (users !== 1) return;
  const b = load();
  if (!b) return;
  try {
    // già alzata (es. QR chiuso e riaperto durante la discesa): si riparte dal valore originale, senza rileggerlo
    if (saved === undefined) {
      const value = await b.getBrightnessAsync();
      // il QR è stato chiuso mentre si leggeva: non è cambiato nulla, non c'è niente da ripristinare
      if (!users) return;
      saved = value;
      current = value;
    }
    rampTo(b, 1, RAMP_UP_MS);
  } catch (e) {
    console.warn('[brightness] impossibile leggere', e);
  }
}

export async function restoreBrightness(): Promise<void> {
  users = Math.max(0, users - 1);
  if (users !== 0) return;
  const b = load();
  if (!b || saved === undefined) return;
  // il valore originale si dimentica solo a discesa finita: un QR riaperto nel frattempo non legge una luminosità intermedia
  rampTo(b, saved, RAMP_DOWN_MS, () => {
    if (users === 0) saved = undefined;
  });
}
