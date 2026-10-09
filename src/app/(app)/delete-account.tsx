import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { GlassPanel } from '@/components/ui/glass-panel';
import { HoldButton } from '@/components/ui/hold-button';
import { IconButton } from '@/components/ui/icon-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { accountKey } from '@/services/accounts';
import { ApiError } from '@/services/api';
import { listAccounts, type SavedAccount } from '@/services/auth';

/**
 * Eliminazione definitiva di un account: si sceglie quale (se ce ne sono più di uno), si riconferma la password e si tiene
 * premuto il pulsante. Il server la rifiuta se l'account ha ancora card assegnate. Per togliere un account solo da questo
 * telefono, senza eliminarlo, c'è il "−" nella lista account del profilo.
 */
export default function DeleteAccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, deleteAccount } = useAuth();
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [selected, setSelected] = useState<string | undefined>(user?.accountKey);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAccounts().then((l) => {
      setAccounts([...l]);
      setSelected((cur) => cur ?? (l[0] ? accountKey(l[0]) : undefined));
    });
  }, []);

  const account = accounts.find((a) => accountKey(a) === selected);

  const onDelete = async () => {
    if (busy || !selected) return;
    if (!password) {
      setError('Inserisci la password per confermare');
      setShakeKey((k) => k + 1);
      return;
    }
    setBusy(true);
    try {
      await deleteAccount(selected, password);
      Alert.alert('Account eliminato', "L'account è stato eliminato definitivamente.");
      if (router.canGoBack()) router.back();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : 'Errore imprevisto');
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <AnimatedBackground variant="rich" />
      <SafeAreaView style={styles.container}>
        <ScreenHeader
          title="Elimina account"
          left={
            <IconButton label="Indietro" onPress={() => router.back()}>
              {(color) => <Ionicons name="chevron-back" size={24} color={color} />}
            </IconButton>
          }
        />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <GlassPanel radius={Radius.lg} style={styles.warning}>
              <TriangleAlert size={28} color={t.danger} strokeWidth={2.2} />
              <Text style={{ color: t.text, fontSize: 15, lineHeight: 22, textAlign: 'center' }}>
                Stai per eliminare <Text style={{ fontWeight: '700' }}>definitivamente</Text> l&apos;account
                {account ? ` ${account.email} presso ${account.ragioneSociale}` : ''}: verranno eliminati il tuo accesso, i tuoi dati e la tua anagrafica presso l&apos;esercente. Puoi farlo solo se non hai card assegnate.
                L&apos;azione non può essere annullata.
              </Text>
            </GlassPanel>

            {accounts.length > 1 && (
              <GlassPanel radius={Radius.lg}>
                {accounts.map((a, i) => {
                  const key = accountKey(a);
                  const active = key === selected;
                  return (
                    <View key={key}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => {
                          setSelected(key);
                          setError(undefined);
                        }}
                        style={styles.row}>
                        <View style={[styles.radio, { borderColor: active ? t.danger : t.textSecondary }]}>{active && <View style={[styles.radioDot, { backgroundColor: t.danger }]} />}</View>
                        <View style={styles.flex}>
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
            )}

            <TextField
              label="Password dell'account"
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError(undefined);
              }}
              error={error}
              shakeKey={shakeKey}
            />

            <HoldButton title="Tieni premuto per eliminare" onConfirm={onDelete} disabled={busy || !password || !selected} />
            <Text style={{ color: t.textSecondary, fontSize: 13, textAlign: 'center' }}>
              Per togliere l&apos;account solo da questo telefono, senza eliminarlo, usa il &quot;−&quot; nella lista account del profilo.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  body: { gap: 18, paddingTop: 12, paddingBottom: 24 },
  warning: { alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 24 },
});
