/**
 * Luminosità al massimo mentre almeno un QR è mostrato; al termine torna al valore di prima.
 * Le variazioni sono graduali. Il modulo nativo viene caricato al primo uso: se la build installata non lo include,
 * la funzione è semplicemente disattivata.
 */
type BrightnessModule = typeof import('expo-brightness');

const STEP_MS = 30;
const RAMP_UP_MS = 450;
const RAMP_DOWN_MS = 450;

let mod: BrightnessModule | null | undefined;
let saved: number | undefined;
let current = 0;
let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;

function load(): BrightnessModule | null {
  if (mod === undefined) {
    try {
      mod = require('expo-brightness') as BrightnessModule;
    } catch (e) {
      console.warn('[brightness] modulo non disponibile', e);
      mod = null;
    }
  }
  return mod;
}

/** Porta la luminosità al valore `to` in `ms`, partendo da quella attuale (interrompe una variazione in corso). */
function rampTo(b: BrightnessModule, to: number, ms: number) {
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
    if (i >= steps) clearInterval(timer);
  }, STEP_MS);
}

export async function boostBrightness(): Promise<void> {
  users += 1;
  if (users !== 1) return;
  const b = load();
  if (!b) return;
  try {
    if (saved === undefined) saved = await b.getBrightnessAsync();
    current = saved;
    if (users > 0) rampTo(b, 1, RAMP_UP_MS);
  } catch (e) {
    console.warn('[brightness] impossibile leggere', e);
  }
}

export async function restoreBrightness(): Promise<void> {
  users = Math.max(0, users - 1);
  if (users !== 0) return;
  const b = load();
  if (!b || saved === undefined) return;
  const value = saved;
  saved = undefined;
  rampTo(b, value, RAMP_DOWN_MS);
}
