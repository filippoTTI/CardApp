import * as Haptics from 'expo-haptics';
import { Delete, ScanFace } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { PIN_LENGTH } from '@/services/app-lock';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/**
 * Tastierino per il codice a 4 cifre: pallini in alto, tasti numerici sotto. Al quarto numero chiama `onComplete`
 * e poi si svuota. Aumentando `shakeKey` i pallini si scuotono (codice errato).
 */
export function PinPad({
  onComplete,
  shakeKey = 0,
  disabled = false,
  onBiometric,
}: {
  onComplete: (pin: string) => void | Promise<void>;
  shakeKey?: number;
  disabled?: boolean;
  /** Se presente, nello spazio vuoto accanto allo 0 compare il tasto per lo sblocco biometrico. */
  onBiometric?: () => void;
}) {
  const t = useTheme();
  const [digits, setDigits] = useState('');
  const busy = useRef(false);
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
        withTiming(0, { duration: 60 }),
      ),
    );
  }, [shakeKey, x]);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const press = (key: (typeof KEYS)[number]) => {
    if (disabled || busy.current || key === '') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === 'del') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    const next = (digits + key).slice(0, PIN_LENGTH);
    setDigits(next);
    if (next.length === PIN_LENGTH) {
      busy.current = true;
      // si lascia vedere l'ultimo pallino pieno prima di controllare e svuotare
      setTimeout(() => {
        Promise.resolve(onComplete(next)).finally(() => {
          setDigits('');
          busy.current = false;
        });
      }, 120);
    }
  };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.dots, shake]} accessibilityLabel={`${digits.length} cifre inserite su ${PIN_LENGTH}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, { borderColor: t.textSecondary }, i < digits.length && { backgroundColor: t.primary, borderColor: t.primary }]} />
        ))}
      </Animated.View>

      <View style={styles.grid}>
        {KEYS.map((key, i) =>
          key === '' ? (
            onBiometric ? (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel="Sblocca con la biometria"
                disabled={disabled}
                onPress={onBiometric}
                style={({ pressed }) => [styles.key, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }]}>
                <ScanFace size={28} color={t.primary} strokeWidth={1.9} />
              </Pressable>
            ) : (
              <View key={i} style={styles.key} />
            )
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Cancella' : key}
              disabled={disabled}
              onPress={() => press(key)}
              style={({ pressed }) => [
                styles.key,
                key !== 'del' && { backgroundColor: t.surface, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth },
                { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
              ]}>
              {key === 'del' ? <Delete size={26} color={t.textSecondary} strokeWidth={1.9} /> : <Text style={{ color: t.text, fontSize: 28, fontWeight: '500' }}>{key}</Text>}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const KEY_SIZE = 76;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 40 },
  dots: { flexDirection: 'row', gap: 22, height: 20, alignItems: 'center' },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  grid: { width: KEY_SIZE * 3 + 2 * 22, flexDirection: 'row', flexWrap: 'wrap', gap: 22, justifyContent: 'center' },
  key: { width: KEY_SIZE, height: KEY_SIZE, borderRadius: KEY_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
});
