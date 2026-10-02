import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

type BackgroundFocus = {
  /** 0 = sfondo nitido, 1 = sfondo sfumato (c'è una card girata). */
  amount: SharedValue<number>;
  /** Da chiamare quando una card si gira (true) o torna al fronte (false). */
  setCardFlipped: (flipped: boolean) => void;
};

const BackgroundFocusContext = createContext<BackgroundFocus | null>(null);

/** Sfuma lo sfondo finché almeno una card è girata, per mettere a fuoco il QR. */
export function BackgroundFocusProvider({ children }: { children: ReactNode }) {
  const amount = useSharedValue(0);
  const flippedCount = useRef(0);

  const setCardFlipped = useCallback(
    (flipped: boolean) => {
      flippedCount.current = Math.max(0, flippedCount.current + (flipped ? 1 : -1));
      amount.set(withTiming(flippedCount.current > 0 ? 1 : 0, { duration: 550, easing: Easing.inOut(Easing.cubic) }));
    },
    [amount],
  );

  const value = useMemo(() => ({ amount, setCardFlipped }), [amount, setCardFlipped]);
  return <BackgroundFocusContext.Provider value={value}>{children}</BackgroundFocusContext.Provider>;
}

export function useBackgroundFocus(): BackgroundFocus {
  const ctx = useContext(BackgroundFocusContext);
  if (!ctx) throw new Error('useBackgroundFocus deve essere usato dentro BackgroundFocusProvider');
  return ctx;
}
