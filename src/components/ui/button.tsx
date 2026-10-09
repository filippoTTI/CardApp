import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useRadius } from '@/context/ui-scale';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  /** Operazione in corso: al posto del testo compare l'indicatore e il tasto non risponde ai tocchi. */
  loading?: boolean;
  /** Tasto non utilizzabile: attenuato e senza risposta ai tocchi. */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: Props) {
  const t = useTheme();
  const radius = useRadius();
  const press = useSharedValue(0);
  const inactive = loading || disabled;
  const dimmed = disabled && !loading;
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.045 }],
    opacity: (dimmed ? 0.45 : 1) * (1 - press.value * 0.12),
  }));
  const bg = variant === 'primary' ? t.primary : 'transparent';
  const fg = variant === 'primary' ? t.primaryText : t.primary;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => press.set(withTiming(1, { duration: 90 }))}
      onPressOut={() => press.set(withSpring(0, { damping: 22, stiffness: 260 }))}
      style={[styles.base, { borderRadius: radius.md, backgroundColor: bg }, style, pressStyle]}>
      {/* il testo resta (invisibile) durante il caricamento: il tasto non cambia dimensione */}
      <Text style={[styles.text, { color: fg }, loading && styles.hidden]}>{title}</Text>
      {loading && <ActivityIndicator color={fg} style={StyleSheet.absoluteFill} />}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  hidden: { opacity: 0 },
  text: { fontSize: 16, fontWeight: '600' },
});
