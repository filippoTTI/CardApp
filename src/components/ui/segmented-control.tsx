import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { GlassPanel } from '@/components/ui/glass-panel';
import { useTheme } from '@/hooks/use-theme';

const HEIGHT = 44;
const PAD = 4;

type Option<T extends string> = { value: T; label: string };

/**
 * Selettore a segmenti (es. i movimenti "Euro" / "Raccolta punti"): un indicatore colorato scorre sotto la voce scelta.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segment = width > 0 ? (width - PAD * 2) / options.length : 0;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segment,
    transform: [{ translateX: withTiming(index * segment, { duration: 220 }) }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View accessibilityRole="tablist" onLayout={onLayout} style={styles.wrap}>
      <GlassPanel radius={HEIGHT / 2} subtle fill />
      {segment > 0 && <Animated.View pointerEvents="none" style={[styles.indicator, { backgroundColor: t.primary }, indicatorStyle]} />}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onChange(o.value);
            }}
            style={styles.option}>
            <Text style={{ color: selected ? t.primaryText : t.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', height: HEIGHT, padding: PAD, marginBottom: 12 },
  indicator: { position: 'absolute', top: PAD, left: PAD, bottom: PAD, borderRadius: (HEIGHT - PAD * 2) / 2 },
  option: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
});
