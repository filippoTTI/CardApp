import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreen, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { EsercenteCodeField } from '@/components/ui/esercente-code-field';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { MISSING_CODE_MESSAGE, useEsercenteCode } from '@/hooks/use-esercente-code';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useTheme } from '@/hooks/use-theme';
import { accountKey, listAccounts, type SavedAccount } from '@/services/accounts';
import { errorMessage, isTransientError } from '@/services/api';
import { signInWithPassword, switchAccount } from '@/services/auth';

export default function LoginScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  // Il codice esercente arriva da un link o da un QR (cardapp://e/<codice>) e non viene mai mostrato.
  const { cod } = useLocalSearchParams<{ cod?: string }>();
  const esercente = useEsercenteCode(cod, 'first-run');
  const { errors, fail, clear, shakeFor } = useFormErrors<'password'>();
  const [saved, setSaved] = useState<SavedAccount[] | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  // il server ha rifiutato l'accesso (non un problema di rete): potrebbe trattarsi di un account non ancora confermato
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    listAccounts().then(setSaved);
  }, []);

  const onError = (e: unknown) => {
    setRejected(!isTransientError(e));
    fail('password', errorMessage(e));
  };

  const onPickAccount = async (key: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const { cliente } = await switchAccount(key);
      signIn(cliente);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const onLogin = async () => {
    if (busy) return;
    if (!esercente.codeValid) return fail('password', MISSING_CODE_MESSAGE);
    setBusy(true);
    try {
      const { cliente } = await signInWithPassword(email, password, esercente.codEsercente);
      signIn(cliente);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const codParams = esercente.codEsercente ? { cod: esercente.codEsercente } : {};

  return (
    <AuthScreen title="Bentornato" subtitle={esercente.linkName ? `Accedi a ${esercente.linkName}` : 'Accedi per continuare'}>
      {!cod &&
        saved?.map((a) => (
          <Pressable
            key={accountKey(a)}
            accessibilityRole="button"
            disabled={busy}
            onPress={() => onPickAccount(accountKey(a))}
            style={({ pressed }) => ({ opacity: pressed || busy ? 0.5 : 1 })}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{a.ragioneSociale}</Text>
            <Text style={{ color: t.textSecondary, fontSize: 13 }}>{a.email}</Text>
          </Pressable>
        ))}
      {esercente.needsCode && (
        <EsercenteCodeField
          code={esercente.code}
          name={esercente.name}
          onChange={(c, n) => {
            esercente.setCode(c, n);
            clear('password');
          }}
        />
      )}
      <TextField
        label="Email"
        placeholder="nome@esempio.it"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setRejected(false);
        }}
      />
      <TextField
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          clear('password');
        }}
        error={errors.password ?? esercente.linkError}
        shakeKey={shakeFor('password')}
      />
      {rejected && (
        <Link href={{ pathname: '/forgot-password', params: { mode: 'conferma', email, ...codParams } } as never} style={{ color: t.primary, fontWeight: '600', textAlign: 'center' }}>
          Non hai ricevuto l&apos;email di conferma?
        </Link>
      )}
      <KeyboardAnchor>
        <Button title="Accedi" onPress={onLogin} loading={busy} disabled={!email.trim() || !password} />
      </KeyboardAnchor>

      <Link href={{ pathname: '/forgot-password', params: { email, ...codParams } } as never} style={{ color: t.textSecondary, textAlign: 'center' }}>
        Password dimenticata?
      </Link>

      <View style={styles.footer}>
        <Text style={{ color: t.textSecondary }}>Non hai un account? </Text>
        <Link href={{ pathname: '/register', params: cod ? { cod } : {} } as never} style={{ color: t.primary, fontWeight: '600' }}>
          Registrati
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
