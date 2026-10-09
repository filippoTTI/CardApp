import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/**
 * Pulsante pericoloso "da tenere premuto": l'azione parte solo dopo aver tenuto premuto per `durationMs`
 * (una barra si riempie mentre si preme), così un tocco casuale non fa nulla. Se si solleva il dito prima, si annulla.
 */
export function HoldButton({
  title,
  holdingTitle = 'Continua a tenere premuto…',
  onConfirm,
  disabled = false,
  durationMs = 2000,
}: {
  title: string;
  holdingTitle?: string;
  onConfirm: () => void;
  disabled?: boolean;
  durationMs?: number;
}) {
  const t = useTheme();
  const progress = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [holding, setHolding] = useState(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  const start = () => {
    if (disabled) return;
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    progress.set(withTiming(1, { duration: durationMs, easing: Easing.linear }));
    timer.current = setTimeout(() => {
      timer.current = undefined;
      setHolding(false);
      progress.set(withTiming(0, { duration: 200 }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      onConfirm();
    }, durationMs);
  };

  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
    setHolding(false);
    progress.set(withTiming(0, { duration: 200 }));
  };

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. Tieni premuto per ${Math.round(durationMs / 1000)} secondi per confermare`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={start}
      onPressOut={cancel}
      style={[styles.button, { borderColor: t.danger, opacity: disabled ? 0.4 : 1 }]}>
      <View style={[StyleSheet.absoluteFill, styles.track]} pointerEvents="none">
        <Animated.View style={[styles.fill, { backgroundColor: t.danger }, fill]} />
      </View>
      <Text style={[styles.label, { color: holding ? '#FFFFFF' : t.danger }]}>{holding ? holdingTitle : title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  track: { borderRadius: 26, overflow: 'hidden' },
  fill: { height: '100%', opacity: 0.9 },
  label: { fontSize: 16, fontWeight: '700' },
});
