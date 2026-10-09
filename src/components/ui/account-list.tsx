import { KeyRound, Minus } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassPanel } from '@/components/ui/glass-panel';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { accountKey } from '@/services/accounts';
import { listAccounts, requestPasswordResetForAccount, type SavedAccount } from '@/services/auth';

/**
 * Account salvati sul dispositivo (uno per esercente e email): tocco sulla riga per passare all'altro,
 * chiave per ricevere il link di recupero password di quell'account, "−" rosso (stile iOS) per rimuoverlo dal dispositivo.
 */
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
  const onRecover = (a: SavedAccount) =>
    Alert.alert('Recupera password', `Inviare il link per reimpostare la password di ${a.email} presso ${a.ragioneSociale}?`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Invia',
        onPress: () =>
          requestPasswordResetForAccount(accountKey(a))
            .then(() => Alert.alert('Recupera password', "Se l'account esiste, riceverai un'email con il link per reimpostare la password."))
            .catch((e) => Alert.alert('Recupera password', e instanceof Error ? e.message : 'Errore imprevisto')),
      },
    ]);

  return (
    <GlassPanel radius={Radius.lg}>
      {accounts.map((a, i) => {
        const key = accountKey(a);
        const active = key === user?.accountKey;
        return (
          <View key={key}>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" onPress={() => onSwitch(key)} style={({ pressed }) => [styles.text, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                  {a.ragioneSociale}
                </Text>
                <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={1}>
                  {a.email}
                </Text>
                {active && <Text style={{ color: t.primary, fontSize: 12, fontWeight: '600' }}>In uso</Text>}
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Recupera la password di ${a.email}`}
                hitSlop={8}
                onPress={() => onRecover(a)}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <KeyRound size={20} color={t.textSecondary} strokeWidth={2} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rimuovi l'account ${a.email}`}
                hitSlop={8}
                onPress={() => onRemove(a)}
                style={({ pressed }) => [styles.minus, { backgroundColor: t.danger, opacity: pressed ? 0.6 : 1 }]}>
                <Minus size={14} color="#FFFFFF" strokeWidth={3.2} />
              </Pressable>
            </View>
            {i < accounts.length - 1 && <View style={[styles.separator, { backgroundColor: t.border }]} />}
          </View>
        );
      })}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: 24, paddingVertical: 14 },
  text: { flex: 1, gap: 2 },
  minus: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 24 },
});
