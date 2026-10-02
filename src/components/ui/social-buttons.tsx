import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/services/api';
import { signInWithGoogle } from '@/services/auth';
import { GoogleSignInError } from '@/services/google';

/** Google (tutte le piattaforme) e Apple (solo iOS, dove è lo standard). Google è collegato; TODO: collegare Apple. */
export function SocialButtons() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  const onGoogle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const session = await signInWithGoogle();
      if (session) signIn({ cliente: session.cliente });
    } catch (e) {
      const message = e instanceof ApiError || e instanceof GoogleSignInError ? e.message : 'Errore imprevisto';
      Alert.alert('Accesso con Google', message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <Button label="Continua con Google" icon="logo-google" variant="social" style={styles.item} onPress={onGoogle} />
      {Platform.OS === 'ios' && (
        <Button label="Continua con Apple" icon="logo-apple" variant="social" style={styles.item} onPress={() => {}} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  item: { flex: 1 },
});
