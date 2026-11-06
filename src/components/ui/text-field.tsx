import * as Haptics from 'expo-haptics';
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useRef, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useEnsureVisible } from '@/components/ui/auth-screen';
import { GlassPanel } from '@/components/ui/glass-panel';
import { useRadius } from '@/context/ui-scale';
import { useTheme } from '@/hooks/use-theme';

type Props = TextInputProps & {
  label: string;
  /** Messaggio di errore: bordo rosso e testo sotto il campo. */
  error?: string;
  /** Aumentarlo a ogni nuovo errore per rifare la scossa (anche se il messaggio è lo stesso). */
  shakeKey?: number;
  /** Riferimento al campo, per passare il focus al successivo. */
  inputRef?: Ref<TextInput>;
};

/** Campo di testo con vetro leggero; in caso di errore scuote il campo con una vibrazione. */
export function TextField({ label, error, shakeKey, inputRef, style, onFocus, secureTextEntry, ...props }: Props) {
  const t = useTheme();
  const radius = useRadius();
  const x = useSharedValue(0);
  const wrapperRef = useRef<View>(null);
  const ensureVisible = useEnsureVisible();
  const [revealed, setRevealed] = useState(false);

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
    <View ref={wrapperRef} style={styles.wrapper}>
      <Text style={[styles.label, { color: error ? t.danger : t.textSecondary }]}>{label}</Text>
      <Animated.View style={shake}>
        <View style={[styles.errorRing, error ? { borderColor: t.danger, borderRadius: radius.md } : null]}>
          <GlassPanel subtle radius={radius.md} style={styles.glass}>
            <TextInput
              ref={inputRef}
              placeholderTextColor={t.textSecondary}
              style={[styles.input, secureTextEntry && styles.inputWithToggle, { color: t.text }, style]}
              secureTextEntry={secureTextEntry && !revealed}
              onFocus={(e) => {
                ensureVisible(wrapperRef.current);
                onFocus?.(e);
              }}
              {...props}
            />
            {secureTextEntry && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={revealed ? 'Nascondi password' : 'Mostra password'}
                hitSlop={8}
                onPress={() => setRevealed((r) => !r)}
                style={styles.toggle}>
                {revealed ? <EyeOff size={20} color={t.textSecondary} /> : <Eye size={20} color={t.textSecondary} />}
              </Pressable>
            )}
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
  inputWithToggle: { paddingRight: 48 },
  toggle: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 48, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 13, fontWeight: '500' },
});
