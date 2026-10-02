import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen, Divider, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { SocialButtons } from '@/components/ui/social-buttons';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { signInWithPassword } from '@/services/auth';
import { isPasskeySupported } from '@/services/passkey';

export default function LoginScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);

  const onLogin = async () => {
    const ok = await signInWithPassword(email, password);
    if (!ok) {
      setError('Password errata');
      setShakeKey((k) => k + 1);
      return;
    }
    signIn({ skipPasskeyOffer: true });
  };

  return (
    <AuthScreen title="Bentornato" subtitle="Accedi per continuare">
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
      {/* TODO: login reale (vedi services/auth.ts). Provvisorio: entra con qualsiasi dato, tranne la password "errata". */}
      <KeyboardAnchor>
        <Button title="Accedi" onPress={onLogin} />
      </KeyboardAnchor>

      {isPasskeySupported() && (
        // TODO: collegare a signInWithPasskey() quando ci sarà il backend
        <Button title="Accedi con passkey" variant="social" renderIcon={(c) => <MaterialCommunityIcons name="face-recognition" size={22} color={c} />} onPress={() => {}} />
      )}

      <Divider label="oppure continua con" />
      <SocialButtons />

      <View style={styles.footer}>
        <Text style={{ color: t.textSecondary }}>Non hai un account? </Text>
        <Link href="/register" style={{ color: t.primary, fontWeight: '600' }}>
          Registrati
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
