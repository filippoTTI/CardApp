import { Lock } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { PinPad } from '@/components/ui/pin-pad';
import { TextField } from '@/components/ui/text-field';
import { useAppLock } from '@/context/app-lock';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { accountKey } from '@/services/accounts';
import { MAX_RECOVERY_FAILURES, getLockUntil } from '@/services/app-lock';
import { listAccounts, type SavedAccount } from '@/services/auth';

function lockMessage(seconds: number): string {
  if (seconds >= 60) return `Troppi tentativi. Riprova tra ${Math.ceil(seconds / 60)} min`;
  return `Troppi tentativi. Riprova tra ${seconds} s`;
}

/** Schermata a tutto schermo che copre l'app finché non si inserisce il codice di sblocco (o non lo si recupera). */
export function LockScreen() {
  const t = useTheme();
  const { unlock, unlockWithBiometric, biometricEnabled } = useAppLock();
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // se i tentativi erano già bloccati (app riaperta durante il blocco) lo si legge subito
  useEffect(() => {
    let active = true;
    getLockUntil().then((until) => {
      if (active && until > 0) setLockedUntil(until);
    });
    return () => {
      active = false;
    };
  }, []);

  // conto alla rovescia del blocco
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const timer = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) setLockedUntil(0);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  // con l'app bloccata il tasto indietro di Android non deve arrivare alle schermate sotto
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (recovering) setRecovering(false);
      return true;
    });
    return () => sub.remove();
  }, [recovering]);

  const tryBiometric = useCallback(() => {
    void unlockWithBiometric();
  }, [unlockWithBiometric]);

  // la biometria si propone da sola appena compare il tastierino; se annullata si usa il codice
  useEffect(() => {
    if (biometricEnabled && !recovering) tryBiometric();
  }, [biometricEnabled, recovering, tryBiometric]);

  const remaining = lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;

  const onComplete = async (pin: string) => {
    const res = await unlock(pin);
    if (res.ok) return;
    setShakeKey((k) => k + 1);
    if (res.lockedUntil) {
      setNow(Date.now());
      setLockedUntil(res.lockedUntil);
      setError(undefined);
    } else {
      setError(res.attemptsLeft !== undefined ? `Codice errato. Tentativi prima del blocco: ${res.attemptsLeft}` : 'Impossibile verificare il codice');
    }
  };

  if (recovering) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: t.background }]}>
        <Recovery onCancel={() => setRecovering(false)} />
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: t.background }]}>
      <SafeAreaView style={styles.container}>
        <View style={styles.top}>
          <View style={[styles.icon, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Lock size={26} color={t.primary} strokeWidth={2.2} />
          </View>
          <Text style={[styles.title, { color: t.text }]}>Inserisci il codice</Text>
          <Text style={[styles.message, { color: remaining || error ? t.danger : t.textSecondary }]}>
            {remaining ? lockMessage(remaining) : (error ?? "Sblocca l'app con il tuo codice di 4 cifre")}
          </Text>
        </View>
        <PinPad onComplete={onComplete} shakeKey={shakeKey} disabled={remaining > 0} onBiometric={biometricEnabled ? tryBiometric : undefined} />
        <Pressable accessibilityRole="button" onPress={() => setRecovering(true)} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: t.primary, fontSize: 15, fontWeight: '600' }}>Codice dimenticato?</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

/**
 * Codice dimenticato: si sceglie uno degli account salvati e se ne digita la password (controllata dal cloud).
 * Se è giusta il codice viene rimosso. Dopo 3 errori consecutivi l'app viene reimpostata: gli account salvati
 * sono rimossi dal telefono (non dal cloud) e si riparte dal login.
 */
function Recovery({ onCancel }: { onCancel: () => void }) {
  const t = useTheme();
  const { recover, disable } = useAppLock();
  const { signOut } = useAuth();
  const [accounts, setAccounts] = useState<SavedAccount[] | null>(null);
  const [selected, setSelected] = useState<string>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAccounts().then((l) => {
      setAccounts([...l]);
      if (l.length > 0) setSelected(accountKey(l[0]));
    });
  }, []);

  const fail = (message: string) => {
    setError(message);
    setShakeKey((k) => k + 1);
  };

  const onConfirm = async () => {
    if (busy || !selected) return;
    if (!password) return fail('Inserisci la password');
    setBusy(true);
    try {
      const res = await recover(selected, password);
      if (res.status === 'reset') {
        signOut();
        Alert.alert('App reimpostata', 'Dopo 3 password errate gli account sono stati rimossi da questo telefono. Accedi di nuovo con le tue credenziali: i dati sul cloud non sono stati toccati.');
      } else if (res.status === 'wrong') {
        setPassword('');
        fail(`Password errata. Tentativi rimasti: ${res.attemptsLeft}. Al ${MAX_RECOVERY_FAILURES}° errore l'app viene reimpostata.`);
      } else if (res.status === 'error') {
        fail(res.message);
      }
      // ok: il codice è stato rimosso e la schermata sparisce da sola
    } finally {
      setBusy(false);
    }
  };

  // nessun account salvato: non c'è nulla da proteggere, il codice si può rimuovere con una conferma
  const onRemoveWithoutAccounts = () =>
    Alert.alert('Rimuovi codice', 'Non ci sono account salvati su questo telefono. Vuoi rimuovere il codice di sblocco?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: () => void disable() },
    ]);

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.recoveryContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <Text style={[styles.title, { color: t.text }]}>Codice dimenticato</Text>
            <Text style={[styles.message, { color: t.textSecondary }]}>
              Per rimuoverlo inserisci la password di uno dei tuoi account. Dopo {MAX_RECOVERY_FAILURES} password errate consecutive l&apos;app viene reimpostata: gli account vengono rimossi da questo telefono, non dal cloud.
            </Text>
          </View>

          {accounts === null ? null : accounts.length === 0 ? (
            <Button title="Rimuovi codice" onPress={onRemoveWithoutAccounts} />
          ) : (
            <>
              {accounts.length > 1 && (
                <View style={[styles.accounts, { borderColor: t.border }]}>
                  {accounts.map((a, i) => {
                    const key = accountKey(a);
                    const active = key === selected;
                    return (
                      <Pressable
                        key={key}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        onPress={() => setSelected(key)}
                        style={[styles.accountRow, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                        <View style={[styles.radio, { borderColor: active ? t.primary : t.textSecondary }]}>{active && <View style={[styles.radioDot, { backgroundColor: t.primary }]} />}</View>
                        <View style={styles.flex}>
                          <Text style={{ color: t.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                            {a.ragioneSociale}
                          </Text>
                          <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={1}>
                            {a.email}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              <TextField
                label={accounts.length === 1 ? `Password di ${accounts[0].email}` : 'Password'}
                placeholder="Password dell'account"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError(undefined);
                }}
                error={error}
                shakeKey={shakeKey}
              />
              <Button title={busy ? 'Verifica in corso…' : 'Conferma'} onPress={onConfirm} />
            </>
          )}

          <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={10} style={({ pressed }) => [styles.cancel, { opacity: pressed ? 0.6 : 1 }]}>
            <Text style={{ color: t.primary, fontSize: 15, fontWeight: '600' }}>Torna al codice</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { zIndex: 1000, elevation: 1000 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 24 },
  top: { alignItems: 'center', gap: 10 },
  icon: { width: 60, height: 60, borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3 },
  message: { fontSize: 15, textAlign: 'center', minHeight: 22 },
  recoveryContent: { flexGrow: 1, justifyContent: 'center', gap: 22, paddingHorizontal: 24, paddingVertical: 24 },
  accounts: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, overflow: 'hidden' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  cancel: { alignSelf: 'center' },
});
