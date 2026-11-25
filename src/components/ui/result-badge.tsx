import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

const SIZE = 112;
const PARTICLES = 12;
const AnimatedPath = Animated.createAnimatedComponent(Path);

type Props = { kind: 'success' | 'error' };

/** Una scintilla della esplosione di conferma: parte dal centro, si allontana e svanisce. */
function Particle({ index, progress, color }: { index: number; progress: SharedValue<number>; color: string }) {
  const angle = (index / PARTICLES) * Math.PI * 2 + (index % 2 ? 0.15 : 0);
  const reach = index % 2 ? 78 : 96;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p === 0 ? 0 : 1 - p,
      transform: [{ translateX: Math.cos(angle) * reach * p }, { translateY: Math.sin(angle) * reach * p }, { scale: 1 - p * 0.6 }],
    };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: color, width: index % 3 ? 7 : 10, height: index % 3 ? 7 : 10 }, style]} />;
}

/** Cerchio che si espande e svanisce attorno al simbolo. */
function Ripple({ progress, color }: { progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: p === 0 ? 0 : 0.45 * (1 - p), transform: [{ scale: 1 + p * 0.9 }] };
  });
  return <Animated.View style={[styles.ripple, { borderColor: color }, style]} />;
}

/**
 * Esito di un'operazione. `success`: cerchio che compare con molla, spunta tracciata, onda e scintille.
 * `error`: cerchio con una scossa, croce tracciata e onda rossa. Ogni esito accompagnato dalla vibrazione di sistema;
 * con "Riduci movimento" restano solo il cerchio e il simbolo, senza onde, scintille e scossa.
 */
export function ResultBadge({ kind }: Props) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const ok = kind === 'success';
  const color = ok ? t.primary : t.danger;
  const iconColor = ok ? t.primaryText : '#FFFFFF';

  const pop = useSharedValue(0);
  const draw = useSharedValue(0);
  const wave = useSharedValue(0);
  const burst = useSharedValue(0);
  const shake = useSharedValue(0);

  useEffect(() => {
    void Haptics.notificationAsync(ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    if (reduced) {
      pop.set(1);
      draw.set(1);
      return;
    }
    pop.set(withSpring(1, { damping: 11, stiffness: 150, mass: 0.8 }));
    draw.set(withDelay(220, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) })));
    wave.set(withDelay(180, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) })));
    if (ok) burst.set(withDelay(260, withTiming(1, { duration: 750, easing: Easing.out(Easing.cubic) })));
    else shake.set(withDelay(300, withSequence(withTiming(-9, { duration: 55 }), withTiming(9, { duration: 90 }), withTiming(-6, { duration: 80 }), withTiming(4, { duration: 70 }), withTiming(0, { duration: 60 }))));
  }, [ok, reduced, pop, draw, wave, burst, shake]);

  const circle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get() * 3),
    transform: [{ scale: pop.get() }, { translateX: shake.get() }],
  }));
  const checkProps = useAnimatedProps(() => ({ strokeDashoffset: 100 * (1 - draw.get()) }));
  const crossProps = useAnimatedProps(() => ({ strokeDashoffset: 62 * (1 - draw.get()) }));

  return (
    <View style={styles.wrap} accessible accessibilityRole="image" accessibilityLabel={ok ? 'Operazione riuscita' : 'Operazione non riuscita'}>
      {!reduced && <Ripple progress={wave} color={color} />}
      {!reduced && ok && Array.from({ length: PARTICLES }, (_, i) => <Particle key={i} index={i} progress={burst} color={i % 3 === 0 ? t.text : color} />)}
      <Animated.View style={[styles.circle, { backgroundColor: color, shadowColor: color }, circle]}>
        <Svg width={SIZE} height={SIZE} viewBox="0 0 112 112">
          {ok ? (
            <AnimatedPath
              d="M32 58 L50 76 L82 38"
              stroke={iconColor}
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={100}
              animatedProps={checkProps}
            />
          ) : (
            <>
              <AnimatedPath d="M38 38 L74 74" stroke={iconColor} strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={62} animatedProps={crossProps} />
              <AnimatedPath d="M74 38 L38 74" stroke={iconColor} strokeWidth={8} strokeLinecap="round" fill="none" strokeDasharray={62} animatedProps={crossProps} />
            </>
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  ripple: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3 },
  particle: { position: 'absolute', borderRadius: 5 },
});
