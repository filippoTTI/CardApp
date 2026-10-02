import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { GlassPanel } from '@/components/ui/glass-panel';
import { useRadius } from '@/context/ui-scale';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  label: string;
  /** Messaggio di errore: bordo rosso e testo sotto il campo. */
  error?: string;
  /** Aumentarlo a ogni nuovo errore per rifare la scossa (anche se il messaggio è lo stesso). */
  shakeKey?: number;
};

/** Campo di testo con vetro leggero; in caso di errore scuote il campo con una vibrazione. */
export function TextField({ label, error, shakeKey, style, ...props }: Props) {
  const t = useTheme();
  const radius = useRadius();
  const x = useSharedValue(0);

  useEffect(() => {
    if (!shakeKey) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    x.set(
      withSequence(
        withTiming(-10, { duration: 55 }),
        withTiming(9, { duration: 70 }),
        withTiming(-7, { duration: 70 }),
        withTiming(5, { duration: 70 }),
        withTiming(-2, { duration: 60 }),
        withTiming(0, { duration: 50 }),
      ),
    );
  }, [shakeKey, x]);

  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: error ? t.danger : t.textSecondary }]}>{label}</Text>
      <Animated.View style={shake}>
        <View style={[styles.errorRing, error ? { borderColor: t.danger, borderRadius: radius.md } : null]}>
          <GlassPanel subtle radius={radius.md} style={styles.glass}>
            <TextInput placeholderTextColor={t.textSecondary} style={[styles.input, { color: t.text }, style]} {...props} />
          </GlassPanel>
        </View>
      </Animated.View>
      {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: '500' },
  errorRing: { borderWidth: 1.5, borderColor: 'transparent' },
  glass: { height: 54, justifyContent: 'center' },
  input: { height: 54, paddingHorizontal: 16, fontSize: 16 },
  error: { fontSize: 13, fontWeight: '500' },
});
