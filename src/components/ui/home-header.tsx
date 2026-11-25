import { Plus, UserRound } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Altezza fissa dell'intestazione: la home la usa per calcolare lo spazio rimasto alle card. */
export const HOME_HEADER_H = 64;

type Props = { caption?: string; onProfile: () => void; onAdd: () => void };

/** Intestazione della home: contesto (account) sopra il titolo, a sinistra; profilo e nuovo account a destra. */
export function HomeHeader({ caption, onProfile, onAdd }: Props) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        {!!caption && (
          <Text numberOfLines={1} style={[Type.caption, { color: t.textSecondary }]}>
            {caption}
          </Text>
        )}
        <Text numberOfLines={1} style={[Type.title, { color: t.text }]}>
          Le mie card
        </Text>
      </View>
      <View style={styles.actions}>
        <IconButton label="Profilo" onPress={onProfile} style={styles.button}>
          {(color) => <UserRound size={21} color={color} strokeWidth={1.9} />}
        </IconButton>
        <IconButton label="Aggiungi account" onPress={onAdd} style={styles.button}>
          {(color) => <Plus size={22} color={color} strokeWidth={1.9} />}
        </IconButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: HOME_HEADER_H, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1, justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  button: { width: 44, height: 44, borderRadius: 22 },
});
