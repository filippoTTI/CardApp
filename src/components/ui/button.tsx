import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { GlassPanel } from '@/components/ui/glass-panel';
import { useRadius } from '@/context/ui-scale';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  /** Se vuoto, il tasto mostra solo l'icona (in quel caso passare `label` per l'accessibilità). */
  title?: string;
  label?: string;
  onPress: () => void;
  variant?: 'primary' | 'social' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  /** Icona custom (altra famiglia di icone); riceve il colore del testo. */
  renderIcon?: (color: string) => ReactNode;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ title, label, onPress, variant = 'primary', icon, renderIcon, style }: Props) {
  const t = useTheme();
  const radius = useRadius();
  const press = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.value * 0.045 }], opacity: 1 - press.value * 0.12 }));
  const glass = variant === 'social'; // i tasti secondari (Google, Apple, passkey) sono in vetro leggero
  const bg = variant === 'primary' ? t.primary : 'transparent';
  const fg = variant === 'primary' ? t.primaryText : variant === 'social' ? t.socialText : t.primary;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label ?? title}
      onPress={onPress}
      onPressIn={() => press.set(withTiming(1, { duration: 90 }))}
      onPressOut={() => press.set(withSpring(0, { damping: 22, stiffness: 260 }))}
      style={[styles.base, { borderRadius: radius.md, backgroundColor: bg, borderColor: 'transparent' }, style, pressStyle]}>
      {glass && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <GlassPanel subtle fill radius={radius.md} />
        </View>
      )}
      {renderIcon ? <View style={title ? styles.icon : undefined}>{renderIcon(fg)}</View> : null}
      {icon && <Ionicons name={icon} size={title ? 20 : 24} color={fg} style={title ? styles.icon : undefined} />}
      {title ? <Text style={[styles.text, { color: fg }]}>{title}</Text> : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  icon: { marginRight: 10 },
  text: { fontSize: 16, fontWeight: '600' },
});
