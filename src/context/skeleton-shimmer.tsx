import { createContext, useContext, useEffect, type ReactNode } from 'react';
import {
  cancelAnimation,
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const SHIMMER_DURATION_MS = 1200;

/** Un solo progresso condiviso: tutti gli skeleton sotto il provider brillano in sincronia. */
const SkeletonShimmerContext = createContext<SharedValue<number> | null>(null);

export function SkeletonShimmerProvider({ children }: { children: ReactNode }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: SHIMMER_DURATION_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(progress);
  }, [progress]);

  return <SkeletonShimmerContext.Provider value={progress}>{children}</SkeletonShimmerContext.Provider>;
}

export function useSkeletonShimmer(): SharedValue<number> {
  const ctx = useContext(SkeletonShimmerContext);
  const fallback = useSharedValue(0);
  return ctx ?? fallback;
}
