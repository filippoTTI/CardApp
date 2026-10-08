import { Check } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassPanel } from '@/components/ui/glass-panel';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { accountKey } from '@/services/accounts';
import { listAccounts, type SavedAccount } from '@/services/auth';

/** Account salvati sul dispositivo (uno per esercente e email): tocco per passare all'altro, pressione lunga per rimuoverlo. */
export function AccountList() {
  const t = useTheme();
  const { user, switchAccount, removeAccount } = useAuth();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);

  const refresh = useCallback(() => {
    listAccounts().then((l) => setAccounts([...l]));
  }, []);
  useEffect(refresh, [refresh, user?.accountKey]);

  if (accounts.length < 2) return null;

  const onSwitch = (key: string) => {
    if (key === user?.accountKey) return;
    switchAccount(key).catch((e) => Alert.alert('Cambia account', e instanceof Error ? e.message : 'Errore imprevisto'));
  };
  const onRemove = (a: SavedAccount) =>
    Alert.alert('Rimuovi account', `Vuoi rimuovere l'account ${a.email} presso ${a.ragioneSociale} da questo dispositivo?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: () => removeAccount(accountKey(a)).then(refresh) },
    ]);

  return (
    <GlassPanel radius={Radius.lg}>
      {accounts.map((a, i) => {
        const key = accountKey(a);
        return (
          <View key={key}>
            <Pressable accessibilityRole="button" onPress={() => onSwitch(key)} onLongPress={() => onRemove(a)} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={styles.text}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                  {a.ragioneSociale}
                </Text>
                <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={1}>
                  {a.email}
                </Text>
              </View>
              {key === user?.accountKey && <Check size={20} color={t.primary} />}
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
  text: { flex: 1, gap: 2 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 24 },
});
