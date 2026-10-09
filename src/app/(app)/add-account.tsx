import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreen, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { EsercenteCodeField } from '@/components/ui/esercente-code-field';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { MISSING_CODE_MESSAGE, useEsercenteCode } from '@/hooks/use-esercente-code';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/services/api';
import { signInWithPassword } from '@/services/auth';

/** Aggiunge un altro account (altro esercente, o altre credenziali) senza sostituire quelli salvati. */
export default function AddAccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();
  // Con un link/QR il codice arriva già compilato e non viene mostrato.
  const { cod } = useLocalSearchParams<{ cod?: string }>();
  const esercente = useEsercenteCode(cod, 'always');
  const { errors, fail, clear, shakeFor } = useFormErrors<'password'>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // si torna alla schermata precedente; se si è arrivati da un link e non c'è nulla dietro, alla home
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const onAdd = async () => {
    if (busy) return;
    if (!esercente.codeValid) return fail('password', MISSING_CODE_MESSAGE);
    setBusy(true);
    try {
      const { cliente } = await signInWithPassword(email, password, esercente.codEsercente);
      signIn(cliente);
      close();
    } catch (e) {
      fail('password', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Aggiungi account" subtitle={esercente.linkName ? `Accedi a ${esercente.linkName}` : 'Accedi presso un altro esercente'}>
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
        onChangeText={setEmail}
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
      <KeyboardAnchor>
        <Button title="Accedi" onPress={onAdd} loading={busy} disabled={!email.trim() || !password} />
      </KeyboardAnchor>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={close} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: t.primary, fontWeight: '600' }}>Annulla</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
