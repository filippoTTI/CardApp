import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthScreen, KeyboardAnchor } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { EsercenteCodeField } from '@/components/ui/esercente-code-field';
import { TextField } from '@/components/ui/text-field';
import { MISSING_CODE_MESSAGE, useEsercenteCode } from '@/hooks/use-esercente-code';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/services/api';
import { requestPasswordReset, resendConfirmation } from '@/services/auth';

/** Recupero password o nuovo invio dell'email di conferma (`mode=conferma`); il codice esercente arriva dal login e non viene mostrato. */
export default function ForgotPasswordScreen() {
  const t = useTheme();
  const { cod, mode, email: emailParam } = useLocalSearchParams<{ cod?: string; mode?: string; email?: string }>();
  const conferma = mode === 'conferma';
  // come nel login: il campo codice compare solo se non c'è un link e non c'è nessun account salvato
  const esercente = useEsercenteCode(cod, 'first-run');
  const { errors, fail, clear, shakeFor } = useFormErrors<'email'>();
  const [email, setEmail] = useState(emailParam ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSend = async () => {
    if (busy) return;
    if (!esercente.codeValid) return fail('email', MISSING_CODE_MESSAGE);
    setBusy(true);
    try {
      await (conferma ? resendConfirmation(email, esercente.codEsercente) : requestPasswordReset(email, esercente.codEsercente));
      setSent(true);
    } catch (e) {
      fail('email', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScreen
      title={conferma ? 'Conferma account' : 'Password dimenticata'}
      subtitle={esercente.linkName ? `Account presso ${esercente.linkName}` : conferma ? "Reinvia l'email di conferma" : 'Ti inviamo un link per reimpostarla'}>
      {esercente.needsCode && (
        <EsercenteCodeField
          code={esercente.code}
          name={esercente.name}
          onChange={(c, n) => {
            esercente.setCode(c, n);
            clear('email');
          }}
        />
      )}
      <TextField
        label="Email"
        placeholder="nome@esempio.it"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          clear('email');
        }}
        error={errors.email ?? esercente.linkError}
        shakeKey={shakeFor('email')}
      />
      {sent && (
        <Text style={{ color: t.textSecondary, textAlign: 'center' }}>
          {conferma ? "Se l'account esiste, riceverai un'email con il link di conferma." : "Se l'account esiste, riceverai un'email con il link per reimpostare la password."}
        </Text>
      )}
      <KeyboardAnchor>
        <Button title={sent ? 'Invia di nuovo' : 'Invia email'} onPress={onSend} loading={busy} disabled={!email.trim()} />
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
