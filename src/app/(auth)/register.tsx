import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { EsercenteCodeField } from '@/components/ui/esercente-code-field';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { MISSING_CODE_MESSAGE, useEsercenteCode } from '@/hooks/use-esercente-code';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/services/api';
import { register, signInWithPassword } from '@/services/auth';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = 'cognome' | 'email' | 'password';

/** Controlli fatti prima di chiamare il server: il primo campo non valido con il suo messaggio, null se è tutto a posto. */
function validate(cognome: string, email: string, password: string): [Field, string] | null {
  if (!cognome.trim()) return ['cognome', 'Il cognome è obbligatorio'];
  if (!EMAIL_PATTERN.test(email.trim())) return ['email', 'Inserisci un indirizzo email valido'];
  if (password.length < MIN_PASSWORD_LENGTH) return ['password', `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri`];
  if (/^\s|\s$/.test(password)) return ['password', 'La password non può iniziare o finire con uno spazio'];
  return null;
}

export default function RegisterScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();
  // Il codice esercente arriva dal link/QR e non viene mostrato; il campo compare solo al primo avvio senza link né account.
  const { cod } = useLocalSearchParams<{ cod?: string }>();
  const esercente = useEsercenteCode(cod, 'first-run');
  const { errors, fail, clear, shakeFor } = useFormErrors<Field>();
  const [info, setInfo] = useState<string>();
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onRegister = async () => {
    if (busy) return;
    if (!esercente.codeValid) return fail('password', MISSING_CODE_MESSAGE);
    const invalid = validate(cognome, email, password);
    if (invalid) return fail(...invalid);
    setBusy(true);
    try {
      const { emailDaConfermare } = await register({ nome, cognome, email, telefono, password }, esercente.codEsercente);
      if (emailDaConfermare) {
        // l'account si attiva dal link ricevuto per email: poi si accede dal login
        setInfo(`Ti abbiamo inviato un'email a ${email.trim()}: conferma l'account dal link, poi accedi.`);
        return;
      }
      const { cliente } = await signInWithPassword(email, password, esercente.codEsercente);
      signIn(cliente);
    } catch (e) {
      fail('password', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Crea account" subtitle={esercente.linkName ? `Registrati presso ${esercente.linkName}` : 'Registrati in pochi secondi'}>
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
      <TextField label="Nome" placeholder="Mario" autoComplete="given-name" value={nome} onChangeText={setNome} />
      <TextField
        label="Cognome"
        placeholder="Rossi"
        autoComplete="family-name"
        value={cognome}
        onChangeText={(v) => {
          setCognome(v);
          clear('cognome');
        }}
        error={errors.cognome}
        shakeKey={shakeFor('cognome')}
      />
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
          clear('email');
        }}
        error={errors.email}
        shakeKey={shakeFor('email')}
      />
      <TextField label="Telefono (facoltativo)" placeholder="+39 333 1234567" keyboardType="phone-pad" autoComplete="tel" value={telefono} onChangeText={setTelefono} />
      <TextField
        label="Password"
        placeholder={`Almeno ${MIN_PASSWORD_LENGTH} caratteri`}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          clear('password');
        }}
        error={errors.password ?? esercente.linkError}
        shakeKey={shakeFor('password')}
      />
      {info && <Text style={{ color: t.textSecondary, textAlign: 'center' }}>{info}</Text>}
      <KeyboardAnchor>
        {info ? (
          <Button title="Vai al login" onPress={() => router.replace({ pathname: '/login', params: cod ? { cod } : {} } as never)} />
        ) : (
          <Button title="Registrati" onPress={onRegister} loading={busy} />
        )}
      </KeyboardAnchor>

      <View style={styles.footer}>
        <Text style={{ color: t.textSecondary }}>Hai già un account? </Text>
        <Link href={{ pathname: '/login', params: cod ? { cod } : {} } as never} style={{ color: t.primary, fontWeight: '600' }}>
          Accedi
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
