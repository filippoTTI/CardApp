import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen, Divider, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { SocialButtons } from '@/components/ui/social-buttons';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { register } from '@/services/auth';

export default function RegisterScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const onRegister = async () => {
    if (busy) return;
    if (!cognome.trim()) {
      setError('Il cognome è obbligatorio');
      setShakeKey((k) => k + 1);
      return;
    }
    setBusy(true);
    try {
      const { cliente } = await register({ nome, cognome, email, telefono, password });
      signIn({ cliente }); // primo accesso: propone la passkey
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore imprevisto');
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen title="Crea account" subtitle="Registrati in pochi secondi">
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
      <KeyboardAnchor>
        <Button title="Registrati" onPress={onRegister} />
      </KeyboardAnchor>

      <Divider label="oppure continua con" />
      <SocialButtons />

      <View style={styles.footer}>
        <Text style={{ color: t.textSecondary }}>Hai già un account? </Text>
        <Link href="/login" style={{ color: t.primary, fontWeight: '600' }}>
          Accedi
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
