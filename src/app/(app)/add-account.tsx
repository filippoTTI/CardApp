import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { fetchEsercente, signInWithPassword } from '@/services/auth';

/** Aggiunge un altro account (altro esercente, o altre credenziali) senza sostituire quelli salvati. */
export default function AddAccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { signIn } = useAuth();
  // Con un link/QR il codice arriva già compilato e non viene mostrato.
  const { cod } = useLocalSearchParams<{ cod?: string }>();
  const [esercente, setEsercente] = useState<string>();
  const [codice, setCodice] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!cod) return;
    fetchEsercente(cod)
      .then((e) => setEsercente(e.ragioneSociale))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Errore imprevisto'));
  }, [cod]);

  const onAdd = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { cliente } = await signInWithPassword(email, password, cod ?? codice);
      signIn({ skipPasskeyOffer: true, cliente });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore imprevisto');
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Aggiungi account" subtitle={esercente ? `Accedi a ${esercente}` : 'Accedi presso un altro esercente'}>
      {!cod && <TextField label="Codice esercente" placeholder="Codice ricevuto dall'esercente" autoCapitalize="characters" autoCorrect={false} value={codice} onChangeText={setCodice} />}
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
      <KeyboardAnchor>
        <Button title="Accedi" onPress={onAdd} />
      </KeyboardAnchor>
      <View style={styles.footer}>
        <Link href="/" style={{ color: t.primary, fontWeight: '600' }}>
          <Text>Annulla</Text>
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
