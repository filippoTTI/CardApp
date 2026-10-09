import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  SensorType,
  useAnimatedSensor,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useAppLock } from '@/context/app-lock';

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

/** Legge il sensore e aggiorna `x` e `y` a ogni frame. Esiste solo mentre serve: smontandolo il sensore si spegne. */
function SensorDriver({ x, y }: Parallax) {
  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: 'auto' });
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const ready = useSharedValue(false);

  useFrameCallback(() => {
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
    x.set(x.get() + (tx - x.get()) * SMOOTHING);
    y.set(y.get() + (ty - y.get()) * SMOOTHING);
  });

  return null;
}

/**
 * Parallasse da sensore di movimento, come lo sfondo di iOS. Un solo sensore per tutta l'app;
 * le schermate leggono `x` e `y` con `useParallax()` e li usano per spostare di pochissimo sfondo e card.
 * Il sensore resta spento (e l'effetto torna al centro) con "Riduci movimento", con l'app in secondo piano
 * o coperta dalla schermata del codice.
 */
export function ParallaxProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const { locked } = useAppLock();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);

  const running = foreground && !locked && !reduceMotion;

  useEffect(() => {
    if (running) return;
    x.set(withTiming(0, { duration: 300 }));
    y.set(withTiming(0, { duration: 300 }));
  }, [running, x, y]);

  return (
    <ParallaxContext.Provider value={{ x, y }}>
      {running && <SensorDriver x={x} y={y} />}
      {children}
    </ParallaxContext.Provider>
  );
}

export function useParallax(): Parallax {
  const ctx = useContext(ParallaxContext);
  if (!ctx) throw new Error('useParallax deve essere usato dentro ParallaxProvider');
  return ctx;
}
