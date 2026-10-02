import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { Button } from '@/components/ui/button';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useTheme } from '@/hooks/use-theme';
import { registerPasskey } from '@/services/passkey';

export default function PasskeySetupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { dismissPasskeyOffer } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const close = () => {
    dismissPasskeyOffer();
    router.back();
  };

  const create = async () => {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      await registerPasskey();
      close();
    } catch {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: t.background }]}>
      <AnimatedBackground variant="rich" />
      <SafeAreaView style={styles.container}>
        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: t.surface }]}>
            <MaterialCommunityIcons name="face-recognition" size={56} color={t.primary} />
          </View>
          <Text style={[styles.title, { color: t.text }]}>Accedi più in fretta con una passkey</Text>
          <Text style={[styles.body, { color: t.textSecondary }]}>
            Usa Face ID, impronta o il blocco schermo del dispositivo al posto della password. Più veloce e più sicuro.
          </Text>
          {error && <Text style={{ color: t.danger }}>Impossibile creare la passkey. Riprova.</Text>}
        </View>
        <View style={styles.actions}>
          <Button title={loading ? 'Attendi…' : 'Crea passkey'} onPress={create} />
          <Button title="Non ora" variant="ghost" onPress={close} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  icon: { width: 112, height: 112, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 16, textAlign: 'center', lineHeight: 22 },
  actions: { gap: 8 },
});
