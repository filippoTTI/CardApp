import { createContext, useContext, type ReactNode } from 'react';
import {
  SensorType,
  useAnimatedSensor,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

type Parallax = {
  /** Inclinazione orizzontale e verticale del telefono, normalizzata e addolcita: da -1 a 1. */
  x: SharedValue<number>;
  y: SharedValue<number>;
};

const ParallaxContext = createContext<Parallax | null>(null);

/** Inclinazione (radianti) che corrisponde al valore massimo ±1. */
const RANGE = 0.35;
/** Quanto rapidamente la "posizione di riposo" segue il telefono: tenendolo inclinato a lungo, l'effetto torna al centro. */
const BASELINE_SPEED = 0.006;
/** Morbidezza dell'inseguimento (più piccolo = più lento e fluido). */
const SMOOTHING = 0.07;

/**
 * Parallasse da sensore di movimento, come lo sfondo di iOS. Un solo sensore per tutta l'app;
 * le schermate leggono `x` e `y` con `useParallax()` e li usano per spostare di pochissimo sfondo e card.
 * Se l'utente ha attivato "Riduci movimento", resta fermo a 0.
 */
export function ParallaxProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: 'auto' });
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const ready = useSharedValue(false);

  useFrameCallback(() => {
    if (reduceMotion) return;
    const { roll, pitch } = sensor.sensor.value;
    if (!ready.value) {
      baseX.value = roll;
      baseY.value = pitch;
      ready.value = true;
      return;
    }
    baseX.value += (roll - baseX.value) * BASELINE_SPEED;
    baseY.value += (pitch - baseY.value) * BASELINE_SPEED;
    const tx = Math.max(-1, Math.min(1, (roll - baseX.value) / RANGE));
    const ty = Math.max(-1, Math.min(1, (pitch - baseY.value) / RANGE));
    x.value += (tx - x.value) * SMOOTHING;
    y.value += (ty - y.value) * SMOOTHING;
  });

  return <ParallaxContext.Provider value={{ x, y }}>{children}</ParallaxContext.Provider>;
}

export function useParallax(): Parallax {
  const ctx = useContext(ParallaxContext);
  if (!ctx) throw new Error('useParallax deve essere usato dentro ParallaxProvider');
  return ctx;
}
