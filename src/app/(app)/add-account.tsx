import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthScreen } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { EsercenteCodeField } from '@/components/ui/esercente-code-field';
import { SavedEsercenti } from '@/components/ui/saved-esercenti';
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
  const [step, setStep] = useState(0);
  const passwordRef = useRef<TextInput>(null);

  // senza link/QR si parte dalla scelta dell'esercente; con il link si va dritti alle credenziali
  const hasCodeStep = esercente.needsCode;
  const credentials = hasCodeStep ? step === 1 : true;

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

  const pickCode = (c: string, n?: string) => {
    esercente.setCode(c, n);
    clear('password');
  };

  const esercenteName = esercente.linkName ?? esercente.name;

  return (
    <AuthScreen
      step={credentials && hasCodeStep ? 1 : 0}
      steps={hasCodeStep ? 2 : 1}
      showLogo={!credentials || !hasCodeStep}
      onBack={hasCodeStep && credentials ? () => setStep(0) : undefined}
      title={credentials ? 'Aggiungi account' : "Scegli l'esercente"}
      subtitle={credentials ? (esercenteName ? `Accedi a ${esercenteName}` : 'Accedi presso un altro esercente') : 'Scansiona il QR o inserisci il codice'}
      action={
        credentials ? (
          <Button title="Accedi" onPress={onAdd} loading={busy} disabled={!email.trim() || !password} />
        ) : (
          <Button title="Continua" onPress={() => setStep(1)} disabled={!esercente.codeValid} />
        )
      }>
      {!credentials && (
        <>
          <SavedEsercenti selected={esercente.code} onSelect={pickCode} />
          <EsercenteCodeField code={esercente.code} name={esercente.name} onChange={pickCode} />
        </>
      )}
      {credentials && (
        <>
          <TextField
            label="Email"
            placeholder="nome@esempio.it"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={email}
            onChangeText={setEmail}
          />
          <TextField
            inputRef={passwordRef}
            label="Password"
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={() => email.trim() && password && onAdd()}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clear('password');
            }}
            error={errors.password ?? esercente.linkError}
            shakeKey={shakeFor('password')}
          />
        </>
      )}
      <Link
        href={{ pathname: '/recupera-password', params: { email, ...(esercente.codEsercente ? { cod: esercente.codEsercente } : {}) } } as never}
        style={{ color: t.textSecondary, textAlign: 'center' }}>
        Password dimenticata?
      </Link>
      <View style={styles.footer}>
        <Text style={{ color: t.textSecondary }}>Non hai un account? </Text>
        <Link href={{ pathname: '/add-registration', params: esercente.codEsercente ? { cod: esercente.codEsercente } : {} } as never} style={{ color: t.primary, fontWeight: '600' }}>
          Registrati
        </Link>
      </View>
      <View style={styles.footer}>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={close} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ color: t.primary, fontWeight: '600' }}>Annulla</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 8 },
});
