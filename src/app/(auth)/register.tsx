import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen, Divider, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { SocialButtons } from '@/components/ui/social-buttons';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';

export default function RegisterScreen() {
  const t = useTheme();
  const { signIn } = useAuth();

  return (
    <AuthScreen title="Crea account" subtitle="Registrati in pochi secondi">
      <TextField label="Nome" placeholder="Mario Rossi" autoComplete="name" />
      <TextField label="Email" placeholder="nome@esempio.it" keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <TextField label="Telefono (facoltativo)" placeholder="+39 333 1234567" keyboardType="phone-pad" autoComplete="tel" />
      <TextField label="Password" placeholder="Almeno 8 caratteri" secureTextEntry autoCapitalize="none" autoComplete="new-password" />
      {/* TODO: registrazione reale. Per ora simula un primo accesso riuscito (propone la passkey). */}
      <KeyboardAnchor>
        <Button title="Registrati" onPress={() => signIn()} />
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
