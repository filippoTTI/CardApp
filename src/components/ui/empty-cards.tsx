import { useIsFocused } from 'expo-router';
import { CreditCard } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useAppLock } from '@/context/app-lock';
import { useTheme } from '@/hooks/use-theme';

const W = 220;
const H = 140;

/** Una card stilizzata dell'illustrazione: rettangolo arrotondato con sfumatura. */
function MiniCard({ id, top, bottom, rotate, x, y, opacity = 1 }: {
  id: string; top: string; bottom: string; rotate: number; x: number; y: number; opacity?: number;
}) {
  return (
    <View style={[styles.mini, { left: x, top: y, opacity, transform: [{ rotate: `${rotate}deg` }] }]}>
      <Svg width={W * 0.78} height={H * 0.78}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W * 0.78} height={H * 0.78} rx={20} fill={`url(#${id})`} />
        <Rect x={16} y={18} width={44} height={8} rx={4} fill="#fff" opacity={0.55} />
        <Rect x={16} y={H * 0.78 - 30} width={70} height={10} rx={5} fill="#fff" opacity={0.4} />
      </Svg>
    </View>
  );
}

/**
 * Stato vuoto: tre card colorate impilate e, davanti, una card tratteggiata (segnaposto per le card che arriveranno).
 * L'illustrazione galleggia piano (oscillazione sinusoidale continua, quindi senza stacchi di loop).
 */
export function EmptyCards() {
  const t = useTheme();
  const clock = useSharedValue(0);
  const frame = useFrameCallback((f) => {
    clock.value = f.timestamp;
  });
  // ferma quando la home non è in primo piano (profilo aperto sopra) o è coperta dalla schermata del codice
  const focused = useIsFocused();
  const { locked } = useAppLock();
  useEffect(() => {
    frame.setActive(focused && !locked);
  }, [focused, locked, frame]);
  const float = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.sin((clock.value / 4200) * Math.PI * 2) * 7 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View entering={FadeInDown.delay(150).duration(550)} style={[styles.illustration, float]}>
        <MiniCard id="m1" top="#BFE5FA" bottom="#7CC3EE" rotate={-12} x={6} y={6} opacity={0.9} />
        <MiniCard id="m2" top="#F4D788" bottom="#CF9B38" rotate={9} x={54} y={14} opacity={0.9} />
        <MiniCard id="m3" top="#B5EBCF" bottom="#6FD09B" rotate={-2} x={26} y={34} />
        <View style={[styles.dashed, { borderColor: t.textSecondary }]}>
          <CreditCard size={34} color={t.textSecondary} strokeWidth={1.8} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).duration(550)} style={styles.texts}>
        <Text style={[styles.title, { color: t.text }]}>Nessuna card</Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Le tue card compariranno qui, con saldo e codice QR, non appena ti verranno assegnate.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 22 },
  illustration: { width: W + 40, height: H + 50 },
  mini: { position: 'absolute' },
  dashed: {
    position: 'absolute',
    left: 56,
    top: 52,
    width: W * 0.78,
    height: H * 0.78,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { alignItems: 'center', gap: 8 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 15, textAlign: 'center', lineHeight: 21, maxWidth: 280 },
});
