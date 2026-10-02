import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useParallax } from '@/context/parallax';

type Props = {
  /** Spostamento massimo in px. Più alto = più "vicino" all'osservatore. */
  shift?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Sposta di pochissimo il contenuto con l'inclinazione del telefono (parallasse). */
export function ParallaxView({ shift = 5, children, style }: Props) {
  const parallax = useParallax();
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: parallax.x.value * shift }, { translateY: parallax.y.value * shift }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
