import { Canvas, Circle, Group, RadialGradient, vec } from '@shopify/react-native-skia';
import { BlurView } from 'expo-blur';
import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { useAppLock } from '@/context/app-lock';
import { useBackgroundFocus } from '@/context/background-focus';
import { useParallax } from '@/context/parallax';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

const CYCLE_MS = 24000;
/** Spostamento massimo dello sfondo (px) e margine extra che lo contiene. */
const BG_SHIFT = 10;
const BG_MARGIN = 16;

const TWO_PI = Math.PI * 2;

type RGB = [number, number, number];
const rgba = ([r, g, b]: RGB, a: number) => `rgba(${r},${g},${b},${a})`;

type Blob = {
  rgb: RGB;
  alpha: number;
  /** Centro in frazione di larghezza/altezza. */
  x: number;
  y: number;
  /** Raggio in frazione della larghezza. */
  r: number;
  /** Ampiezza dell'orbita in frazione di larghezza/altezza. */
  ax: number;
  ay: number;
  /** Giri interi per ciclo sui due assi (se diversi l'orbita diventa un 8 / ellisse inclinata). */
  kx: 1 | 2;
  ky: 1 | 2;
  /** Fase iniziale in giri (0–1) e schiacciamento orizzontale. */
  phase: number;
  stretch: number;
};

const BASE_LIGHT: Blob[] = [
  { rgb: [34, 197, 94], alpha: 0.55, x: 0.2, y: 0.18, r: 0.9, ax: 0.3, ay: 0.1, kx: 1, ky: 1, phase: 0, stretch: 1.3 },
  { rgb: [56, 189, 248], alpha: 0.45, x: 0.85, y: 0.45, r: 0.8, ax: 0.3, ay: 0.12, kx: 1, ky: 2, phase: 0.3, stretch: 1.0 },
  { rgb: [110, 231, 183], alpha: 0.5, x: 0.25, y: 0.85, r: 0.95, ax: 0.32, ay: 0.1, kx: 1, ky: 1, phase: 0.6, stretch: 1.5 },
  { rgb: [167, 139, 250], alpha: 0.3, x: 0.85, y: 0.92, r: 0.7, ax: 0.25, ay: 0.12, kx: 2, ky: 1, phase: 0.85, stretch: 1.0 },
];
const BASE_DARK: Blob[] = [
  { rgb: [34, 197, 94], alpha: 0.45, x: 0.2, y: 0.18, r: 0.9, ax: 0.3, ay: 0.1, kx: 1, ky: 1, phase: 0, stretch: 1.3 },
  { rgb: [20, 184, 166], alpha: 0.36, x: 0.85, y: 0.45, r: 0.8, ax: 0.3, ay: 0.12, kx: 1, ky: 2, phase: 0.3, stretch: 1.0 },
  { rgb: [56, 189, 248], alpha: 0.28, x: 0.25, y: 0.85, r: 0.95, ax: 0.32, ay: 0.1, kx: 1, ky: 1, phase: 0.6, stretch: 1.5 },
  { rgb: [139, 92, 246], alpha: 0.3, x: 0.85, y: 0.92, r: 0.7, ax: 0.25, ay: 0.12, kx: 2, ky: 1, phase: 0.85, stretch: 1.0 },
];

// Variante `rich` (login): macchie in più, più piccole e luminose, che si incrociano con le altre.
const EXTRA_LIGHT: Blob[] = [
  { rgb: [16, 185, 129], alpha: 0.6, x: 0.5, y: 0.35, r: 0.55, ax: 0.38, ay: 0.16, kx: 1, ky: 2, phase: 0.15, stretch: 1.2 },
  { rgb: [14, 165, 233], alpha: 0.5, x: 0.4, y: 0.65, r: 0.5, ax: 0.4, ay: 0.14, kx: 2, ky: 1, phase: 0.55, stretch: 1.0 },
  { rgb: [196, 181, 253], alpha: 0.5, x: 0.6, y: 0.1, r: 0.45, ax: 0.35, ay: 0.12, kx: 1, ky: 1, phase: 0.75, stretch: 1.4 },
];
const EXTRA_DARK: Blob[] = [
  { rgb: [16, 185, 129], alpha: 0.5, x: 0.5, y: 0.35, r: 0.55, ax: 0.38, ay: 0.16, kx: 1, ky: 2, phase: 0.15, stretch: 1.2 },
  { rgb: [14, 165, 233], alpha: 0.4, x: 0.4, y: 0.65, r: 0.5, ax: 0.4, ay: 0.14, kx: 2, ky: 1, phase: 0.55, stretch: 1.0 },
  { rgb: [167, 139, 250], alpha: 0.4, x: 0.6, y: 0.1, r: 0.45, ax: 0.35, ay: 0.12, kx: 1, ky: 1, phase: 0.75, stretch: 1.4 },
];

function BlobView({ blob, clock, width, height }: { blob: Blob; clock: SharedValue<number>; width: number; height: number }) {
  const r = blob.r * width;
  const transform = useDerivedValue(() => {
    const c = clock.value / CYCLE_MS + blob.phase;
    return [
      { translateX: blob.x * width + Math.sin(c * TWO_PI * blob.kx) * blob.ax * width },
      { translateY: blob.y * height + Math.cos(c * TWO_PI * blob.ky) * blob.ay * height },
      { scaleX: blob.stretch },
      { rotate: Math.sin(c * TWO_PI) * 0.6 },
    ];
  });

  return (
    <Group transform={transform}>
      <Circle cx={0} cy={0} r={r}>
        <RadialGradient c={vec(0, 0)} r={r} colors={[rgba(blob.rgb, blob.alpha), rgba(blob.rgb, 0)]} />
      </Circle>
    </Group>
  );
}

type Dot = { x: number; size: number; speed: 1 | 2 | 3; offset: number; sway: number };
const DOTS: Dot[] = Array.from({ length: 10 }, (_, i) => ({
  x: ((i * 0.6180339) % 1) * 0.92 + 0.04,
  size: 1.5 + ((i * 7) % 4) * 0.8,
  speed: ((i % 3) + 1) as 1 | 2 | 3,
  offset: (i * 0.37) % 1,
  sway: 8 + (i % 5) * 5,
}));

function DotView({ dot, clock, width, height, rgb }: {
  dot: Dot; clock: SharedValue<number>; width: number; height: number; rgb: RGB;
}) {
  // f va 0→1 e poi ricomincia mentre il punto è invisibile (opacità 0 agli estremi): nessuno stacco.
  const f = useDerivedValue(() => ((clock.value / CYCLE_MS) * dot.speed + dot.offset) % 1);
  const cx = useDerivedValue(() => dot.x * width + Math.sin(f.value * TWO_PI) * dot.sway);
  const cy = useDerivedValue(() => height * (1.05 - f.value * 1.1));
  const opacity = useDerivedValue(() => Math.sin(f.value * Math.PI) * 0.9);
  return <Circle cx={cx} cy={cy} r={dot.size} color={rgba(rgb, 1)} opacity={opacity} />;
}

type Props = { variant?: 'soft' | 'rich' };

/**
 * Sfondo animato soft, disegnato con Skia (nessun file video):
 *  1. macchie di colore sfumate che orbitano lentamente
 *  2. (variante `rich`) macchie extra più grandi e luminose, che si sovrappongono
 *  3. piccole particelle che salgono e brillano
 *
 * LOOP SENZA STACCO: non usa animazioni che ripartono (withRepeat). Un unico orologio cresce
 * all'infinito e ogni movimento è una funzione periodica con numero INTERO di giri per ciclo
 * (CYCLE_MS), quindi non c'è mai un "fine" e "ricomincia". Se aggiungi movimenti, usa solo
 * velocità intere (1, 2, 3).
 * TODO: se arriva un video/Lottie, sostituire il contenuto di questo componente.
 */
export function AnimatedBackground({ variant = 'soft' }: Props) {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const { width, height } = useWindowDimensions();

  // Orologio assoluto in millisecondi, sempre crescente: più istanze (una per schermata) restano sincronizzate.
  const clock = useSharedValue(0);
  const frame = useFrameCallback((info) => {
    clock.value = info.timestamp;
  });

  // Una schermata non in primo piano (es. quella che sta uscendo durante una transizione) smette di animare:
  // meno lavoro per frame mentre il telefono sta già animando il cambio schermata.
  // Idem sotto la schermata del codice, che la copre per intero.
  const focused = useIsFocused();
  const { locked } = useAppLock();
  useEffect(() => {
    frame.setActive(focused && !locked);
  }, [focused, locked, frame]);

  // Parallasse quasi impercettibile: lo sfondo scorre di pochi pixel in senso opposto all'inclinazione.
  const parallax = useParallax();
  const shift = useAnimatedStyle(() => ({
    transform: [{ translateX: -parallax.x.value * BG_SHIFT }, { translateY: -parallax.y.value * BG_SHIFT }],
  }));

  // Quando una card è girata lo sfondo si sfuma (sfocatura + velo), per mettere a fuoco il QR.
  const focus = useBackgroundFocus();
  const focusStyle = useAnimatedStyle(() => ({ opacity: focus.amount.value }));

  const blobs = [...(dark ? BASE_DARK : BASE_LIGHT), ...(variant === 'rich' ? (dark ? EXTRA_DARK : EXTRA_LIGHT) : [])];
  const dotColor: RGB = dark ? [190, 255, 220] : [22, 163, 74];

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.background }]}>
      {/* più grande dello schermo di BG_MARGIN per lato, così spostandosi non scopre i bordi */}
      <Animated.View style={[styles.parallax, shift]}>
        <Canvas style={StyleSheet.absoluteFill}>
          {blobs.map((b, i) => (
            <BlobView key={`b${i}`} blob={b} clock={clock} width={width} height={height} />
          ))}
          {DOTS.map((d, i) => (
            <DotView key={`d${i}`} dot={d} clock={clock} width={width} height={height} rgb={dotColor} />
          ))}
        </Canvas>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, focusStyle]}>
        {Platform.OS === 'ios' && <BlurView intensity={60} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.22)' }]} />
      </Animated.View>
      {/* velo leggero sopra lo sfondo: più contrasto per card e contenuti */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.28)' : 'rgba(6,40,22,0.12)' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  parallax: { position: 'absolute', top: -BG_MARGIN, left: -BG_MARGIN, right: -BG_MARGIN, bottom: -BG_MARGIN },
});
