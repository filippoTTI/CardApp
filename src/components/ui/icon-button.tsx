import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = {
  label: string;
  onPress: () => void;
  /** Riceve il colore del testo del tema. */
  children: (color: string) => ReactNode;
  /** Solo icona, senza cerchio, sfondo e bordo. */
  bare?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Pulsante circolare con sola icona. */
export function IconButton({ label, onPress, children, bare, style }: Props) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        !bare && { backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth },
        { opacity: pressed ? 0.6 : 1 },
        style,
      ]}>
      {children(t.text)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
