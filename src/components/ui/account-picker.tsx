import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassPanel } from '@/components/ui/glass-panel';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { accountKey, type SavedAccount } from '@/services/accounts';

/** Scelta di uno degli account salvati (esercente ed email) con pulsanti radio; `color` è il colore della selezione. */
export function AccountPicker({
  accounts,
  selected,
  onSelect,
  color,
}: {
  accounts: SavedAccount[];
  selected: string | undefined;
  onSelect: (key: string) => void;
  color: string;
}) {
  const t = useTheme();
  return (
    <GlassPanel radius={Radius.lg}>
      {accounts.map((a, i) => {
        const key = accountKey(a);
        const active = key === selected;
        return (
          <View key={key}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${a.ragioneSociale}, ${a.email}`}
              onPress={() => onSelect(key)}
              style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={[styles.radio, { borderColor: active ? color : t.textSecondary }]}>{active && <View style={[styles.dot, { backgroundColor: color }]} />}</View>
              <View style={styles.text}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                  {a.ragioneSociale}
                </Text>
                <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={1}>
                  {a.email}
                </Text>
              </View>
            </Pressable>
            {i < accounts.length - 1 && <View style={[styles.separator, { backgroundColor: t.border }]} />}
          </View>
        );
      })}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { flex: 1 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 24 },
});
