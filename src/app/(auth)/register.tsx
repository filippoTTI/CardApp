import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

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
import { register, signInWithPassword } from '@/services/auth';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = 'cognome' | 'email' | 'password';

/** Controlli del passo "profilo": il campo non valido con il suo messaggio, null se è tutto a posto. */
function validateProfile(cognome: string): [Field, string] | null {
  if (!cognome.trim()) return ['cognome', 'Il cognome è obbligatorio'];
  return null;
}

/** Controlli del passo "accesso", fatti prima di chiamare il server. */
function validateAccess(email: string, password: string): [Field, string] | null {
  if (!EMAIL_PATTERN.test(email.trim())) return ['email', 'Inserisci un indirizzo email valido'];
  if (password.length < MIN_PASSWORD_LENGTH) return ['password', `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri`];
  if (/^\s|\s$/.test(password)) return ['password', 'La password non può iniziare o finire con uno spazio'];
  return null;
}

/** `embedded`: aperta dall'app con un account già dentro (si aggiunge un altro account); alla fine si torna indietro invece di passare dal login. */
export function RegisterScreen({ embedded = false }: { embedded?: boolean }) {
  const t = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();
  // Il codice esercente arriva dal link/QR e non viene mostrato; senza link si sceglie un esercente già salvato o se ne inserisce uno nuovo.
  const { cod } = useLocalSearchParams<{ cod?: string }>();
  const esercente = useEsercenteCode(cod, 'always');
  const { errors, fail, clear, shakeFor } = useFormErrors<Field>();
  const [info, setInfo] = useState<string>();
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const cognomeRef = useRef<TextInput>(null);
  const telefonoRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Senza link/QR il primo passo è la scelta dell'esercente; poi dati personali e credenziali.
  const steps = esercente.needsCode ? (['esercente', 'profilo', 'accesso'] as const) : (['profilo', 'accesso'] as const);
  const current = steps[step] ?? 'accesso';
  const isLast = step === steps.length - 1;

  const loginParams = { pathname: '/login', params: cod ? { cod } : {} } as never;
  const close = () => (router.canGoBack() ? router.back() : router.replace(embedded ? '/' : loginParams));
  const goBack = () => (step > 0 ? setStep(step - 1) : close());

  const onNext = () => {
    if (current === 'profilo') {
      const invalid = validateProfile(cognome);
      if (invalid) return fail(...invalid);
    }
    setStep(step + 1);
  };

  const onRegister = async () => {
    if (busy) return;
    if (!esercente.codeValid) return fail('password', MISSING_CODE_MESSAGE);
    const invalid = validateAccess(email, password);
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
      if (embedded) close();
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

  if (info) {
    return (
      <AuthScreen title="Controlla la tua email" subtitle={info} action={<Button title={embedded ? 'Chiudi' : 'Vai al login'} onPress={embedded ? close : () => router.replace(loginParams)} />}>
        {null}
      </AuthScreen>
    );
  }

  const titles = {
    esercente: ["Scegli l'esercente", 'Scansiona il QR o inserisci il codice'],
    profilo: ['Crea account', esercente.linkName ? `Registrati presso ${esercente.linkName}` : 'Dicci chi sei'],
    accesso: ['Le tue credenziali', 'Ti serviranno per accedere'],
  } as const;

  return (
    <AuthScreen
      step={step}
      steps={steps.length}
      showLogo={step === 0}
      onBack={step > 0 ? goBack : undefined}
      title={titles[current][0]}
      subtitle={titles[current][1]}
      action={
        isLast ? (
          <Button title="Registrati" onPress={onRegister} loading={busy} disabled={!email.trim() || !password} />
        ) : (
          <Button title="Continua" onPress={onNext} disabled={current === 'esercente' && !esercente.codeValid} />
        )
      }>
      {current === 'esercente' && (
        <>
          <SavedEsercenti selected={esercente.code} onSelect={pickCode} />
          <EsercenteCodeField code={esercente.code} name={esercente.name} onChange={pickCode} />
        </>
      )}
      {current === 'profilo' && (
        <>
          <TextField
            label="Nome"
            placeholder="Mario"
            autoComplete="given-name"
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => cognomeRef.current?.focus()}
            value={nome}
            onChangeText={setNome}
          />
          <TextField
            inputRef={cognomeRef}
            label="Cognome"
            placeholder="Rossi"
            autoComplete="family-name"
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => telefonoRef.current?.focus()}
            value={cognome}
            onChangeText={(v) => {
              setCognome(v);
              clear('cognome');
            }}
            error={errors.cognome}
            shakeKey={shakeFor('cognome')}
          />
          <TextField
            inputRef={telefonoRef}
            label="Telefono (facoltativo)"
            placeholder="+39 333 1234567"
            keyboardType="phone-pad"
            autoComplete="tel"
            value={telefono}
            onChangeText={setTelefono}
          />
        </>
      )}
      {current === 'accesso' && (
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
            onChangeText={(v) => {
              setEmail(v);
              clear('email');
            }}
            error={errors.email}
            shakeKey={shakeFor('email')}
          />
          <TextField
            inputRef={passwordRef}
            label="Password"
            placeholder={`Almeno ${MIN_PASSWORD_LENGTH} caratteri`}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            returnKeyType="go"
            onSubmitEditing={() => email.trim() && password && onRegister()}
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
      <View style={styles.footer}>
        <Text style={{ color: t.textSecondary }}>Hai già un account? </Text>
        {embedded ? (
          <Text accessibilityRole="link" onPress={close} style={{ color: t.primary, fontWeight: '600' }}>
            Accedi
          </Text>
        ) : (
          <Link href={loginParams} style={{ color: t.primary, fontWeight: '600' }}>
            Accedi
          </Link>
        )}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 8 },
});

export default function RegisterRoute() {
  return <RegisterScreen />;
}
