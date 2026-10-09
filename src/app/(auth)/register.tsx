import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen, Divider, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { EsercenteCodeField } from '@/components/ui/esercente-code-field';
import { hasSocialLogin, SocialButtons } from '@/components/ui/social-buttons';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { fetchEsercente, listAccounts, register, signInWithPassword } from '@/services/auth';

export default function RegisterScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();
  // Il codice esercente arriva dal link/QR e non viene mostrato; il campo compare solo al primo avvio senza link né account.
  const { cod } = useLocalSearchParams<{ cod?: string }>();
  const [esercente, setEsercente] = useState<string>();
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null);
  const [codice, setCodice] = useState('');
  const [codeName, setCodeName] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAccounts().then((l) => setHasAccounts(l.length > 0));
  }, []);

  useEffect(() => {
    if (!cod) return;
    fetchEsercente(cod)
      .then((e) => setEsercente(e.ragioneSociale))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Errore imprevisto'));
  }, [cod]);

  const needsCode = !cod && hasAccounts === false;
  const codEsercente = cod ?? codice;

  const onRegister = async () => {
    if (busy) return;
    if (needsCode && !codeName) {
      setError('Inserisci un codice esercente valido o scansiona il QR');
      setShakeKey((k) => k + 1);
      return;
    }
    if (!cognome.trim()) {
      setError('Il cognome è obbligatorio');
      setShakeKey((k) => k + 1);
      return;
    }
    setBusy(true);
    try {
      const { emailDaConfermare } = await register({ nome, cognome, email, telefono, password }, codEsercente);
      if (emailDaConfermare) {
        // l'account si attiva dal link ricevuto per email: poi si accede dal login
        setInfo(`Ti abbiamo inviato un'email a ${email.trim()}: conferma l'account dal link, poi accedi.`);
        return;
      }
      const { cliente } = await signInWithPassword(email, password, codEsercente);
      signIn({ cliente }); // primo accesso: propone la passkey
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore imprevisto');
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Crea account" subtitle={esercente ? `Registrati presso ${esercente}` : 'Registrati in pochi secondi'}>
      {needsCode && <EsercenteCodeField
          code={codice}
          name={codeName}
          onChange={(c, n) => {
            setCodice(c);
            setCodeName(n);
            setError(undefined);
          }}
        />}
      <TextField label="Nome" placeholder="Mario" autoComplete="given-name" value={nome} onChangeText={setNome} />
      <TextField
        label="Cognome"
        placeholder="Rossi"
        autoComplete="family-name"
        value={cognome}
        onChangeText={(v) => {
          setCognome(v);
          setError(undefined);
        }}
      />
      <TextField label="Email" placeholder="nome@esempio.it" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
      <TextField label="Telefono (facoltativo)" placeholder="+39 333 1234567" keyboardType="phone-pad" autoComplete="tel" value={telefono} onChangeText={setTelefono} />
      <TextField
        label="Password"
        placeholder="Almeno 8 caratteri"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(undefined);
        }}
        error={error}
        shakeKey={shakeKey}
      />
      {info && <Text style={{ color: t.textSecondary, textAlign: 'center' }}>{info}</Text>}
      <KeyboardAnchor>
        {info ? <Button title="Vai al login" onPress={() => router.replace({ pathname: '/login', params: cod ? { cod } : {} } as never)} /> : <Button title="Registrati" onPress={onRegister} />}
      </KeyboardAnchor>

      {hasSocialLogin && (
        <>
          <Divider label="oppure continua con" />
          <SocialButtons />
        </>
      )}

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
