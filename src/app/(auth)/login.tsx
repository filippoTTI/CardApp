import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthScreen, Divider, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { EsercenteCodeField } from '@/components/ui/esercente-code-field';
import { hasSocialLogin, SocialButtons } from '@/components/ui/social-buttons';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { accountKey } from '@/services/accounts';
import { ApiError } from '@/services/api';
import { fetchEsercente, listAccounts, signInWithPassword, switchAccount, type SavedAccount } from '@/services/auth';
import { isPasskeySupported } from '@/services/passkey';

export default function LoginScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  // Il codice esercente arriva da un link o da un QR (cardapp://e/<codice>) e non viene mai mostrato.
  const { cod } = useLocalSearchParams<{ cod?: string }>();
  const [saved, setSaved] = useState<SavedAccount[] | null>(null);
  const [esercente, setEsercente] = useState<string>();
  const [codice, setCodice] = useState('');
  const [codeName, setCodeName] = useState<string>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAccounts().then(setSaved);
  }, []);

  // Con un link/QR il nome dell'esercente (preso dal server) sostituisce il sottotitolo.
  useEffect(() => {
    if (!cod) return;
    fetchEsercente(cod)
      .then((e) => setEsercente(e.ragioneSociale))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Errore imprevisto'));
  }, [cod]);

  // Il campo codice compare solo se non c'è un link e non c'è nessun account salvato (primo avvio).
  const needsCode = !cod && saved !== null && saved.length === 0;
  const codEsercente = cod ?? codice;

  const onPickAccount = async (key: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const { cliente } = await switchAccount(key);
      signIn({ skipPasskeyOffer: true, cliente });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore imprevisto');
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  const onLogin = async () => {
    if (busy) return;
    if (needsCode && !codeName) {
      setError('Inserisci un codice esercente valido o scansiona il QR');
      setShakeKey((k) => k + 1);
      return;
    }
    setBusy(true);
    try {
      const { cliente } = await signInWithPassword(email, password, codEsercente);
      signIn({ skipPasskeyOffer: true, cliente });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore imprevisto');
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Bentornato" subtitle={esercente ? `Accedi a ${esercente}` : 'Accedi per continuare'}>
      {!cod &&
        saved?.map((a) => (
          <Pressable key={`${a.codEsercente}|${a.email}`} accessibilityRole="button" onPress={() => onPickAccount(accountKey(a))} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{a.ragioneSociale}</Text>
            <Text style={{ color: t.textSecondary, fontSize: 13 }}>{a.email}</Text>
          </Pressable>
        ))}
      {needsCode && <EsercenteCodeField
          code={codice}
          name={codeName}
          onChange={(c, n) => {
            setCodice(c);
            setCodeName(n);
            setError(undefined);
          }}
        />}
      <TextField label="Email" placeholder="nome@esempio.it" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
      <TextField
        label="Password"
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(undefined);
        }}
        error={error}
        shakeKey={shakeKey}
      />
      {error?.toLowerCase().includes('validato') && (
        <Link href={{ pathname: '/forgot-password', params: { mode: 'conferma', email, ...(codEsercente ? { cod: codEsercente } : {}) } } as never} style={{ color: t.primary, fontWeight: '600', textAlign: 'center' }}>
          Reinvia email di conferma
        </Link>
      )}
      <KeyboardAnchor>
        <Button title="Accedi" onPress={onLogin} />
      </KeyboardAnchor>

      <Link href={{ pathname: '/forgot-password', params: { email, ...(codEsercente ? { cod: codEsercente } : {}) } } as never} style={{ color: t.textSecondary, textAlign: 'center' }}>
        Password dimenticata?
      </Link>

      {isPasskeySupported() && (
        // TODO: collegare a signInWithPasskey() quando ci sarà il backend
        <Button title="Accedi con passkey" variant="social" renderIcon={(c) => <MaterialCommunityIcons name="face-recognition" size={22} color={c} />} onPress={() => {}} />
      )}

      {hasSocialLogin && (
        <>
          <Divider label="oppure continua con" />
          <SocialButtons />
        </>
      )}

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
