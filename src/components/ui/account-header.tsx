import { ChevronDown } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Iniziali (max 2) del nome dell'esercente, per l'avatar. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** Intestazione di un account nella home: avatar, esercente ed email, numero di card, tocco per comprimere o espandere. */
export function AccountHeader({
  title,
  subtitle,
  count,
  loading,
  expanded,
  onPress,
}: {
  title: string;
  subtitle: string;
  count: number;
  loading: boolean;
  expanded: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const rotate = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(expanded ? '180deg' : '0deg', { duration: 220 }) }] }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.avatar, { backgroundColor: `${t.primary}26` }]}>
        <Text style={[Type.section, { color: t.primary }]}>{initials(title)}</Text>
      </View>
      <View style={styles.text}>
        <Text style={[Type.section, { color: t.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[Type.caption, { color: t.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={t.textSecondary} />
      ) : (
        <View style={[styles.badge, { backgroundColor: t.surface }]}>
          <Text style={[Type.caption, { color: t.textSecondary, fontWeight: '700' }]}>{count}</Text>
        </View>
      )}
      <Animated.View style={rotate}>
        <ChevronDown size={20} color={t.textSecondary} strokeWidth={2} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: Spacing.two + 2,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  badge: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
});
