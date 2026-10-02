import * as Haptics from 'expo-haptics';
import { CreditCard, QrCode as QrIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { QrCode } from '@/components/ui/qr-code';
import { useBackgroundFocus } from '@/context/background-focus';
import { useParallax } from '@/context/parallax';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildQrPayload } from '@/services/qr';
import type { Card, CardKind } from '@/types/card';

/** Spazio da lasciare sotto ogni card: maggiore dell'ombra, così non si sovrappone alla card successiva. */
export const CARD_SHADOW_CLEARANCE = 28;

/** Spostamento massimo (px) della card per il parallasse. */
const CARD_SHIFT = 5;

// Geometria in unità (viewBox) 340 × 214 = proporzioni di una carta di credito.
const W = 340;
const H = 214;
const R = 30; // raggio angoli
const NW = 28; // semilarghezza dell'incavo centrale (alto e basso)
const ND = 11; // profondità dell'incavo: meno di mezzo cerchio, spalle morbide
const NS = 17; // morbidezza delle spalle (quanto la curva si raccorda al bordo)
const M = 44; // margine extra del disegno per contenere l'ombra

/** Sagoma "biglietto": rettangolo arrotondato con un incavo poco profondo e raccordato al centro di alto e basso. */
const SHAPE = [
  `M ${R} 0`,
  `L ${W / 2 - NW} 0`,
  `C ${W / 2 - NW + NS} 0 ${W / 2 - NS} ${ND} ${W / 2} ${ND}`,
  `C ${W / 2 + NS} ${ND} ${W / 2 + NW - NS} 0 ${W / 2 + NW} 0`,
  `L ${W - R} 0`,
  `A ${R} ${R} 0 0 1 ${W} ${R}`,
  `L ${W} ${H - R}`,
  `A ${R} ${R} 0 0 1 ${W - R} ${H}`,
  `L ${W / 2 + NW} ${H}`,
  `C ${W / 2 + NW - NS} ${H} ${W / 2 + NS} ${H - ND} ${W / 2} ${H - ND}`,
  `C ${W / 2 - NS} ${H - ND} ${W / 2 - NW + NS} ${H} ${W / 2 - NW} ${H}`,
  `L ${R} ${H}`,
  `A ${R} ${R} 0 0 1 0 ${H - R}`,
  `L 0 ${R}`,
  `A ${R} ${R} 0 0 1 ${R} 0`,
  'Z',
].join(' ');

/** Ombra: spostamento verso il basso e strati (larghezza del contorno, opacità). */
const SHADOW_DY = 6;
const SHADOW_LAYERS = Array.from({ length: 8 }, (_, i) => ({ width: 3 + i * 2.6, opacity: 0.04 }));

/** Curve di livello concentriche (effetto cartina topografica) al centro della card. */
const CONTOURS = [
  { rx: 48, ry: 26 },
  { rx: 84, ry: 44 },
  { rx: 122, ry: 64 },
  { rx: 162, ry: 86 },
  { rx: 206, ry: 110 },
  { rx: 254, ry: 136 },
];

type Palette = {
  bgTop: string;
  bgBottom: string;
  line: string;
  text: string;
  textSoft: string;
  qrBox: string;
  edge: string;
  shadow: string;
};
/**
 * Colori per tipo di card, ognuno con variante chiara e scura. Prepagata = azzurro, postpagata = viola-orchidea, standard = verde, gift = oro:
 * entrambi stanno bene con il verde dello sfondo e restano distinti tra loro.
 */
const PALETTES: Record<CardKind, Record<'light' | 'dark', Palette>> = {
  prepaid: {
    light: {
      bgTop: '#BFE5FA',
      bgBottom: '#7CC3EE',
      line: 'rgba(8,52,86,0.06)',
      text: '#06243D',
      textSoft: 'rgba(6,36,61,0.68)',
      qrBox: '#FFFFFF',
      edge: 'rgba(255,255,255,0.7)',
      shadow: '#052414',
    },
    dark: {
      bgTop: '#1B3C55',
      bgBottom: '#0F2538',
      line: 'rgba(150,210,245,0.06)',
      text: '#E8F5FD',
      textSoft: 'rgba(232,245,253,0.62)',
      qrBox: '#FFFFFF',
      edge: 'rgba(150,210,245,0.22)',
      shadow: '#000000',
    },
  },
  postpaid: {
    light: {
      bgTop: '#E6C8F8',
      bgBottom: '#B880EA',
      line: 'rgba(60,10,95,0.06)',
      text: '#33084F',
      textSoft: 'rgba(51,8,79,0.68)',
      qrBox: '#FFFFFF',
      edge: 'rgba(255,255,255,0.7)',
      shadow: '#052414',
    },
    dark: {
      bgTop: '#4F2574',
      bgBottom: '#2B1446',
      line: 'rgba(225,195,252,0.06)',
      text: '#F6EBFF',
      textSoft: 'rgba(246,235,255,0.62)',
      qrBox: '#FFFFFF',
      edge: 'rgba(220,180,252,0.22)',
      shadow: '#000000',
    },
  },
  standard: {
    light: {
      bgTop: '#B5EBCF',
      bgBottom: '#6FD09B',
      line: 'rgba(7,60,34,0.06)',
      text: '#052A18',
      textSoft: 'rgba(5,42,24,0.68)',
      qrBox: '#FFFFFF',
      edge: 'rgba(255,255,255,0.7)',
      shadow: '#052414',
    },
    dark: {
      bgTop: '#1F4634',
      bgBottom: '#0F2A1E',
      line: 'rgba(150,235,185,0.06)',
      text: '#E6F8EE',
      textSoft: 'rgba(230,248,238,0.62)',
      qrBox: '#FFFFFF',
      edge: 'rgba(150,235,185,0.22)',
      shadow: '#000000',
    },
  },
  gift: {
    light: {
      bgTop: '#F4D788',
      bgBottom: '#CF9B38',
      line: 'rgba(90,55,5,0.07)',
      text: '#3F2603',
      textSoft: 'rgba(63,38,3,0.68)',
      qrBox: '#FFFFFF',
      edge: 'rgba(255,248,220,0.75)',
      shadow: '#052414',
    },
    dark: {
      bgTop: '#8F7215',
      bgBottom: '#4F3E09',
      line: 'rgba(255,232,140,0.07)',
      text: '#FFF3C4',
      textSoft: 'rgba(255,243,196,0.68)',
      qrBox: '#FFFFFF',
      edge: 'rgba(255,226,120,0.30)',
      shadow: '#000000',
    },
  },
};

const KIND_LABEL: Record<CardKind, string> = { prepaid: 'Prepagata', postpaid: 'Postpagata', standard: 'Standard', gift: 'Gift card' };

/** Sfondo vettoriale della card: ombra (copie sfalsate della sagoma), colore, curve di livello, piega centrale, bordo. */
function CardBackground({ palette, id, width }: { palette: Palette; id: string; width: number }) {
  const s = width / W;
  const size = { width: (W + M * 2) * s, height: (H + M * 2) * s };
  return (
    <Svg
      pointerEvents="none"
      style={[styles.svg, { left: -M * s, top: -M * s, ...size }]}
      viewBox={`${-M} ${-M} ${W + M * 2} ${H + M * 2}`}>
      <Defs>
        <LinearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={palette.bgTop} />
          <Stop offset="1" stopColor={palette.bgBottom} />
        </LinearGradient>
        <ClipPath id={`clip-${id}`}>
          <Path d={SHAPE} />
        </ClipPath>
      </Defs>

      {/* Ombra morbida che segue la sagoma (incavi compresi): molti contorni sempre più larghi e quasi
          trasparenti, sovrapposti, simulano la sfumatura di un blur (nessun filtro, funziona ovunque). */}
      {SHADOW_LAYERS.map(({ width: w, opacity }) => (
        <G key={w} y={SHADOW_DY}>
          <Path d={SHAPE} fill={palette.shadow} stroke={palette.shadow} strokeWidth={w} strokeLinejoin="round" opacity={opacity} />
        </G>
      ))}
      {/* ombra di contatto, stretta e più scura: stacca il bordo inferiore dal fondo */}
      <G y={2.5}>
        <Path d={SHAPE} fill={palette.shadow} stroke={palette.shadow} strokeWidth={3} strokeLinejoin="round" opacity={0.2} />
      </G>

      <Path d={SHAPE} fill={`url(#bg-${id})`} />
      <G clipPath={`url(#clip-${id})`}>
        {CONTOURS.map((c) => (
          <Ellipse key={c.rx} cx={W / 2} cy={H / 2} rx={c.rx} ry={c.ry} stroke={palette.line} strokeWidth={1} fill="none" />
        ))}
      </G>
      <Path d={SHAPE} fill="none" stroke={palette.edge} strokeWidth={1} />
    </Svg>
  );
}

/** Stile di una faccia: prospettiva + rotazione di flip (offset 0 = fronte, 180 = retro). */
function useFaceStyle(offset: number, flip: SharedValue<number>, press: SharedValue<number>) {
  return useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { scale: 1 - press.value * 0.025 },
      { rotateY: `${interpolate(flip.value, [0, 1], [offset, offset + 180])}deg` },
    ],
  }));
}

function formatBalance(balance: Card['balance']): { value: string; unit: string } {
  if (balance.type === 'euro') {
    return { value: new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(balance.amount), unit: 'Saldo' };
  }
  return { value: new Intl.NumberFormat('it-IT').format(balance.amount), unit: 'Punti' };
}

/**
 * Card a "biglietto" (stile Wallet): sagoma con incavi, colore pastel, curve di livello,
 * tipografia grande. Da ferma resta dritta; al tocco si gira mostrando il QR generato dal codice.
 */
export function FlipCard({ card }: { card: Card }) {
  const palette = PALETTES[card.kind][useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [width, setWidth] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const flip = useSharedValue(0); // 0 = fronte, 1 = retro
  const press = useSharedValue(0);

  const { setCardFlipped } = useBackgroundFocus();
  // Se la card sparisce mentre è girata, lo sfondo deve tornare nitido.
  const flippedRef = useRef(false);
  useEffect(
    () => () => {
      if (flippedRef.current) setCardFlipped(false);
    },
    [setCardFlipped],
  );

  const toggle = () => {
    const next = !flipped;
    setFlipped(next);
    flippedRef.current = next;
    setCardFlipped(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flip.set(withTiming(next ? 1 : 0, { duration: 750, easing: Easing.inOut(Easing.cubic) }));
  };

  // Parallasse quasi impercettibile: la card si muove di pochi pixel nel verso opposto allo sfondo, per dare profondità.
  const parallax = useParallax();
  const float = useAnimatedStyle(() => ({
    transform: [{ translateX: parallax.x.value * CARD_SHIFT }, { translateY: parallax.y.value * CARD_SHIFT }],
  }));

  const frontStyle = useFaceStyle(0, flip, press);
  const backStyle = useFaceStyle(180, flip, press);
  const { value, unit } = formatBalance(card.balance);
  const k = width / W; // scala tipografia in base alla larghezza reale

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={flipped ? 'Mostra fronte della card' : 'Mostra QR code della card'}
      onPress={toggle}
      onPressIn={() => press.set(withTiming(1, { duration: 120 }))}
      onPressOut={() => press.set(withTiming(0, { duration: 180 }))}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.box, float]}>
        {width > 0 && (
          <>
            {/* FRONTE */}
            <Animated.View style={[styles.face, frontStyle]}>
              <CardBackground palette={palette} id={`f${card.id}`} width={width} />
              <View style={[styles.content, { padding: 22 * k }]}>
                <View style={styles.topRow}>
                  <View style={styles.brandRow}>
                    <CreditCard size={24 * k} color={palette.text} strokeWidth={2} />
                    <Text style={[styles.brand, { color: palette.text, fontSize: 16 * k }]}>{KIND_LABEL[card.kind]}</Text>
                  </View>
                  <QrIcon size={24 * k} color={palette.text} strokeWidth={2} />
                </View>

                {/* due livelli: codice in alto a sinistra, saldo in basso a destra */}
                <View>
                  <Text style={[styles.code, { color: palette.text, fontSize: 34 * k }]}>{card.code}</Text>
                  <Text style={[styles.small, { color: palette.textSoft, fontSize: 13 * k }]}>Codice card</Text>
                </View>

                <View style={styles.balanceRow}>
                  <Text style={[styles.big, { color: palette.text, fontSize: 30 * k }]} numberOfLines={1} adjustsFontSizeToFit>
                    {value}
                  </Text>
                  <Text style={[styles.small, { color: palette.textSoft, fontSize: 13 * k }]}>{unit}</Text>
                </View>
              </View>
            </Animated.View>

            {/* RETRO */}
            <Animated.View style={[styles.face, backStyle]}>
              <CardBackground palette={palette} id={`b${card.id}`} width={width} />
              <View style={[styles.content, styles.backContent]}>
                <View style={{ backgroundColor: palette.qrBox, padding: 10 * k, borderRadius: 16 * k }}>
                  <QrCode value={buildQrPayload(card)} size={112 * k} />
                </View>
                <Text style={[styles.codeSmall, { color: palette.text, fontSize: 15 * k }]}>{card.code}</Text>
              </View>
            </Animated.View>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { aspectRatio: W / H },
  face: { ...StyleSheet.absoluteFill, backfaceVisibility: 'hidden' },
  svg: { position: 'absolute' },
  content: { ...StyleSheet.absoluteFill, justifyContent: 'space-between' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { fontWeight: '700', letterSpacing: 0.3 },
  balanceRow: { alignItems: 'flex-end' },
  code: { fontWeight: '800', letterSpacing: 3 },
  big: { fontWeight: '800', letterSpacing: -0.5 },
  small: { fontWeight: '500', marginTop: 2 },
  backContent: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  codeSmall: { fontWeight: '800', letterSpacing: 4 },
});
