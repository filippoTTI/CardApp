import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { IconButton } from '@/components/ui/icon-button';
import { PinPad } from '@/components/ui/pin-pad';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useAppLock } from '@/context/app-lock';
import { useTheme } from '@/hooks/use-theme';
import { getLockUntil } from '@/services/app-lock';

type Mode = 'set' | 'change' | 'disable';
type Step = 'current' | 'new' | 'confirm';

const TITLES: Record<Mode, string> = { set: 'Proteggi app', change: 'Cambia codice', disable: 'Disattiva codice' };
const PROMPTS: Record<Step, string> = {
  current: 'Inserisci il codice attuale',
  new: 'Scegli un nuovo codice di 4 cifre',
  confirm: 'Ripeti il codice per confermare',
};

/**
 * Attiva, cambia o disattiva il codice di sblocco dell'app.
 * Per cambiarlo o disattivarlo bisogna prima inserire quello attuale. Il codice resta solo su questo dispositivo.
 */
export default function PinSetupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode: Mode = modeParam === 'change' || modeParam === 'disable' ? modeParam : 'set';
  const { verify, setPin, disable } = useAppLock();

  const [step, setStep] = useState<Step>(mode === 'set' ? 'new' : 'current');
  const [first, setFirst] = useState('');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    getLockUntil().then((until) => {
      if (active && until > 0) setLockedUntil(until);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const timer = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) setLockedUntil(0);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const remaining = lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;

  const fail = (message: string) => {
    setError(message);
    setShakeKey((k) => k + 1);
  };

  const onComplete = async (pin: string) => {
    setError(undefined);
    if (step === 'current') {
      const res = await verify(pin);
      if (!res.ok) {
        if (res.lockedUntil) {
          setNow(Date.now());
          setLockedUntil(res.lockedUntil);
          fail('Troppi tentativi, riprova più tardi');
        } else {
          fail(res.attemptsLeft !== undefined ? `Codice errato. Tentativi prima del blocco: ${res.attemptsLeft}` : 'Impossibile verificare il codice');
        }
        return;
      }
      if (mode === 'disable') {
        await disable();
        router.back();
        return;
      }
      setStep('new');
      return;
    }

    if (step === 'new') {
      setFirst(pin);
      setStep('confirm');
      return;
    }

    // conferma: deve coincidere con il primo inserimento
    if (pin !== first) {
      setFirst('');
      setStep('new');
      fail('I due codici non coincidono, riprova');
      return;
    }
    try {
      await setPin(pin);
      router.back();
    } catch (e) {
      Alert.alert(TITLES[mode], e instanceof Error ? e.message : 'Errore imprevisto');
    }
  };

  const message = remaining ? `Troppi tentativi. Riprova tra ${remaining >= 60 ? `${Math.ceil(remaining / 60)} min` : `${remaining} s`}` : error;

  return (
    <View style={styles.flex}>
      <AnimatedBackground variant="rich" />
      <SafeAreaView style={styles.container}>
        <ScreenHeader
          title={TITLES[mode]}
          left={
            <IconButton label="Indietro" onPress={() => router.back()}>
              {(color) => <Ionicons name="chevron-back" size={24} color={color} />}
            </IconButton>
          }
        />
        <View style={styles.body}>
          <View style={styles.top}>
            <Text style={[styles.prompt, { color: t.text }]}>{PROMPTS[step]}</Text>
            <Text style={[styles.message, { color: message ? t.danger : t.textSecondary }]}>
              {message ?? (mode === 'set' && step === 'new' ? "Il codice resta solo su questo telefono e vale per tutti gli account" : ' ')}
            </Text>
          </View>
          <PinPad key={step} onComplete={onComplete} shakeKey={shakeKey} disabled={remaining > 0} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly' },
  top: { alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  prompt: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', minHeight: 20 },
});
