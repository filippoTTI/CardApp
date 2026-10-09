import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Intestazione di un account nella home: esercente ed email, numero di card, tocco per comprimere o espandere. */
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
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1, borderBottomColor: t.border }]}>
      <View style={styles.text}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={t.textSecondary} />
      ) : (
        <Text style={{ color: t.textSecondary, fontSize: 14, fontWeight: '600' }}>{count}</Text>
      )}
      <Chevron size={22} color={t.textSecondary} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 2 },
});
