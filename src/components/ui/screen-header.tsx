import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Props = { title: string; left?: ReactNode; right?: ReactNode };

/** Barra in alto: pulsante a sinistra, titolo al centro, pulsante a destra. */
export function ScreenHeader({ title, left, right }: Props) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.side}>{left}</View>
      <Text numberOfLines={1} style={[styles.title, { color: t.text }]}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  side: { width: 56 },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '700' },
});
