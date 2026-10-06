import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/services/api';
import { changePassword } from '@/services/auth';

const MIN_LENGTH = 8;

type Errors = { current?: string; next?: string; confirm?: string };

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const fail = (e: Errors) => {
    setErrors(e);
    setShakeKey((k) => k + 1);
  };

  const onSubmit = async () => {
    if (busy) return;
    if (!current) return fail({ current: 'Inserisci la password attuale' });
    if (next.length < MIN_LENGTH) return fail({ next: `Almeno ${MIN_LENGTH} caratteri` });
    if (next === current) return fail({ next: 'La nuova password deve essere diversa da quella attuale' });
    if (confirm !== next) return fail({ confirm: 'Le due password non coincidono' });

    setBusy(true);
    try {
      await changePassword(current, next);
      Alert.alert('Password cambiata', 'La nuova password è attiva. Le sessioni aperte sugli altri dispositivi sono state chiuse.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : 'Errore imprevisto';
      // 422: la password attuale non è corretta; gli altri errori non dipendono da un campo preciso
      fail(e instanceof ApiError && e.cod === 422 ? { current: message } : { next: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <AnimatedBackground variant="rich" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
        <View style={styles.header}>
          <ScreenHeader
            title="Cambia password"
            left={
              <IconButton label="Indietro" onPress={() => router.back()}>
                {(color) => <Ionicons name="chevron-back" size={24} color={color} />}
              </IconButton>
            }
          />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <TextField
            label="Password attuale"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            value={current}
            onChangeText={(v) => {
              setCurrent(v);
              setErrors((e) => ({ ...e, current: undefined }));
            }}
            error={errors.current}
            shakeKey={shakeKey}
          />
          <TextField
            label="Nuova password"
            placeholder={`Almeno ${MIN_LENGTH} caratteri`}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            value={next}
            onChangeText={(v) => {
              setNext(v);
              setErrors((e) => ({ ...e, next: undefined }));
            }}
            error={errors.next}
            shakeKey={shakeKey}
          />
          <TextField
            label="Ripeti la nuova password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            value={confirm}
            onChangeText={(v) => {
              setConfirm(v);
              setErrors((e) => ({ ...e, confirm: undefined }));
            }}
            error={errors.confirm}
            shakeKey={shakeKey}
          />
          <Button title="Cambia password" onPress={onSubmit} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20 },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, gap: 18 },
});
