import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { fetchEsercente, listAccounts, requestPasswordReset, resendConfirmation } from '@/services/auth';

/** Recupero password o nuovo invio dell'email di conferma (`mode=conferma`); il codice esercente arriva dal login e non viene mostrato. */
export default function ForgotPasswordScreen() {
  const t = useTheme();
  const { cod, mode, email: emailParam } = useLocalSearchParams<{ cod?: string; mode?: string; email?: string }>();
  const conferma = mode === 'conferma';
  const [esercente, setEsercente] = useState<string>();
  const [hasAccounts, setHasAccounts] = useState<boolean | null>(null);
  const [codice, setCodice] = useState('');
  const [email, setEmail] = useState(emailParam ?? '');
  const [error, setError] = useState<string>();
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    listAccounts().then((l) => setHasAccounts(l.length > 0));
  }, []);

  useEffect(() => {
    if (!cod) return;
    fetchEsercente(cod)
      .then((e) => setEsercente(e.ragioneSociale))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Errore imprevisto'));
  }, [cod]);

  // Come nel login: il campo codice compare solo se non c'è un link e non c'è nessun account salvato.
  const needsCode = !cod && hasAccounts === false;
  const codEsercente = cod ?? codice;

  const onSend = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await (conferma ? resendConfirmation(email, codEsercente) : requestPasswordReset(email, codEsercente));
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Errore imprevisto');
      setShakeKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title={conferma ? 'Conferma account' : 'Password dimenticata'}
      subtitle={esercente ? `Account presso ${esercente}` : conferma ? "Reinvia l'email di conferma" : 'Ti inviamo un link per reimpostarla'}>
      {needsCode && <TextField label="Codice esercente" placeholder="Codice ricevuto dall'esercente" autoCapitalize="characters" autoCorrect={false} value={codice} onChangeText={setCodice} />}
      <TextField
        label="Email"
        placeholder="nome@esempio.it"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          setError(undefined);
        }}
        error={error}
        shakeKey={shakeKey}
      />
      {sent && (
        <Text style={{ color: t.textSecondary, textAlign: 'center' }}>
          {conferma ? "Se l'account esiste, riceverai un'email con il link di conferma." : "Se l'account esiste, riceverai un'email con il link per reimpostare la password."}
        </Text>
      )}
      <KeyboardAnchor>
        <Button title={sent ? 'Invia di nuovo' : 'Invia email'} onPress={onSend} />
      </KeyboardAnchor>
      <View style={styles.footer}>
        <Link href={{ pathname: '/login', params: cod ? { cod } : {} } as never} style={{ color: t.primary, fontWeight: '600' }}>
          Torna al login
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center' },
});
