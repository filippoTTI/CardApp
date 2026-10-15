/** Palette di una card ricavata dal colore scelto dall'esercente (CARDDETTAGLIO.Colore, es. "#1f4634"). */
export type CardPalette = {
  bgTop: string;
  bgBottom: string;
  line: string;
  text: string;
  textSoft: string;
  qrBox: string;
  edge: string;
  shadow: string;
};

type Rgb = [number, number, number];

/** "#RRGGBB" o "#RGB" in componenti 0-255; undefined se il testo non è un colore esadecimale. */
function parseHex(value: string | undefined): Rgb | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value?.trim() ?? '');
  if (!m) return undefined;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/** Mescola `a` con `b`: t = 0 dà `a`, t = 1 dà `b`. */
function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
}

const hex = ([r, g, b]: Rgb) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const rgba = ([r, g, b]: Rgb, alpha: number) => `rgba(${r},${g},${b},${alpha})`;

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/**
 * Stessa resa delle palette per tipo (pastel in chiaro, tono scuro in scuro) a partire da un solo colore.
 * Restituisce undefined se il colore manca o non è valido: la card usa allora i colori del suo tipo.
 */
export function paletteFromColor(color: string | undefined, scheme: 'light' | 'dark'): CardPalette | undefined {
  const base = parseHex(color);
  if (!base) return undefined;

  if (scheme === 'light') {
    const text = mix(base, BLACK, 0.78);
    return {
      bgTop: hex(mix(base, WHITE, 0.7)),
      bgBottom: hex(mix(base, WHITE, 0.35)),
      line: rgba(mix(base, BLACK, 0.7), 0.06),
      text: hex(text),
      textSoft: rgba(text, 0.68),
      qrBox: '#FFFFFF',
      edge: 'rgba(255,255,255,0.7)',
      shadow: '#052414',
    };
  }
  const text = mix(base, WHITE, 0.88);
  return {
    bgTop: hex(mix(base, BLACK, 0.55)),
    bgBottom: hex(mix(base, BLACK, 0.78)),
    line: rgba(mix(base, WHITE, 0.6), 0.06),
    text: hex(text),
    textSoft: rgba(text, 0.62),
    qrBox: '#FFFFFF',
    edge: rgba(mix(base, WHITE, 0.5), 0.22),
    shadow: '#000000',
  };
}
