import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { AuthScreen } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { EsercenteCodeField } from '@/components/ui/esercente-code-field';
import { SavedEsercenti } from '@/components/ui/saved-esercenti';
import { TextField } from '@/components/ui/text-field';
import { MISSING_CODE_MESSAGE, useEsercenteCode } from '@/hooks/use-esercente-code';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/services/api';
import { requestPasswordReset, resendConfirmation } from '@/services/auth';

/** Recupero password o nuovo invio dell'email di conferma (`mode=conferma`); il codice esercente arriva dal login e non viene mostrato. */
export default function ForgotPasswordScreen() {
  const t = useTheme();
  const router = useRouter();
  const { cod, mode, email: emailParam } = useLocalSearchParams<{ cod?: string; mode?: string; email?: string }>();
  const conferma = mode === 'conferma';
  // come nel login: il campo codice compare solo se non c'è un link e non c'è nessun account salvato
  const esercente = useEsercenteCode(cod, 'always');
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

  const pickCode = (c: string, n?: string) => {
    esercente.setCode(c, n);
    clear('email');
  };

  return (
    <AuthScreen
      onBack={() => (router.canGoBack() ? router.back() : router.replace({ pathname: '/login', params: cod ? { cod } : {} } as never))}
      title={conferma ? 'Conferma account' : 'Password dimenticata'}
      subtitle={esercente.linkName ? `Account presso ${esercente.linkName}` : conferma ? "Reinvia l'email di conferma" : 'Ti inviamo un link per reimpostarla'}
      action={<Button title={sent ? 'Invia di nuovo' : 'Invia email'} onPress={onSend} loading={busy} disabled={!email.trim()} />}>
      {esercente.needsCode && (
        <>
          <SavedEsercenti selected={esercente.code} onSelect={pickCode} />
          <EsercenteCodeField code={esercente.code} name={esercente.name} onChange={pickCode} />
        </>
      )}
      <TextField
        label="Email"
        placeholder="nome@esempio.it"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={() => email.trim() && onSend()}
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
    </AuthScreen>
  );
}
