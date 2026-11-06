import { Link, useLocalSearchParams } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthScreen } from '@/components/ui/auth-screen';
import { Button } from '@/components/ui/button';
import { EsercenteCodeField } from '@/components/ui/esercente-code-field';
import { SavedEsercenti } from '@/components/ui/saved-esercenti';
import { TextField } from '@/components/ui/text-field';
import { useAuth } from '@/context/auth';
import { MISSING_CODE_MESSAGE, useEsercenteCode } from '@/hooks/use-esercente-code';
import { useFormErrors } from '@/hooks/use-form-errors';
import { useTheme } from '@/hooks/use-theme';
import { accountKey, getLastKey, listAccounts, type SavedAccount } from '@/services/accounts';
import { errorMessage, isTransientError } from '@/services/api';
import { forgetAccount, signInWithPassword, switchAccount } from '@/services/auth';
import { authenticateDevice } from '@/services/biometric';

type Page = 'account' | 'esercente' | 'credenziali';

export default function LoginScreen() {
  const t = useTheme();
  const { signIn } = useAuth();
  // Il codice esercente arriva da un link o da un QR (cardapp://e/<codice>) e non viene mai mostrato.
  const { cod } = useLocalSearchParams<{ cod?: string }>();
  const esercente = useEsercenteCode(cod, 'always');
  const { errors, fail, clear, shakeFor } = useFormErrors<'password' | 'account'>();
  const [saved, setSaved] = useState<SavedAccount[] | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const passwordRef = useRef<TextInput>(null);
  // il server ha rifiutato l'accesso (non un problema di rete): potrebbe trattarsi di un account non ancora confermato
  const [rejected, setRejected] = useState(false);

  // account proposto al login: l'ultimo usato; con la verifica di un solo account si entra, e gli altri si aprono dentro l'app
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    Promise.all([listAccounts(), getLastKey()]).then(([l, last]) => {
      setSelected(last ?? (l[0] ? accountKey(l[0]) : undefined));
      setSaved(l);
    });
  }, []);

  // Una schermata per volta, senza scorrimento: account salvati (se ce ne sono), scelta dell'esercente (se non arriva da un link), credenziali.
  const pages: Page[] = cod ? ['credenziali'] : [...(saved?.length ? (['account'] as const) : []), 'esercente', 'credenziali'];
  const page = pages[Math.min(pageIndex, pages.length - 1)];
  // i puntini contano solo i passi per entrare con un account nuovo, non la lista degli account salvati
  const dots: Page[] = pages.filter((p) => p !== 'account');

  const onError = (e: unknown) => {
    setRejected(!isTransientError(e));
    fail(page === 'credenziali' ? 'password' : 'account', errorMessage(e));
  };

  // Si conferma l'identità una volta sola (Face ID / impronta), poi si entra con la password salvata dell'account scelto:
  // gli altri account salvati si aprono dall'app senza altre verifiche. Se il server rifiuta la password (es. cambiata)
  // si passa alle credenziali con email ed esercente già compilati.
  const onEnter = async () => {
    const a = saved?.find((x) => accountKey(x) === selected);
    if (!a || busy) return;
    clear('account');
    if (!(await authenticateDevice(`Accedi a ${a.ragioneSociale}`))) return;
    setBusy(true);
    try {
      const { cliente } = await switchAccount(accountKey(a));
      signIn(cliente);
    } catch (e) {
      if (isTransientError(e)) return fail('account', errorMessage(e));
      esercente.setCode(a.codEsercente, a.ragioneSociale);
      setEmail(a.email);
      setPassword('');
      setPageIndex(pages.length - 1);
      fail('password', 'La password salvata non è più valida: inseriscila di nuovo');
    } finally {
      setBusy(false);
    }
  };

  const onForget = (a: SavedAccount) =>
    Alert.alert('Rimuovi account', `Vuoi togliere ${a.email} presso ${a.ragioneSociale} da questo telefono? Non viene eliminato: potrai riaccedere con email e password.`, [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Rimuovi',
        style: 'destructive',
        onPress: () =>
          forgetAccount(accountKey(a))
            .then(listAccounts)
            .then((l) => {
              setSaved([...l]);
              setSelected((cur) => (l.some((x) => accountKey(x) === cur) ? cur : l[0] ? accountKey(l[0]) : undefined));
              setPageIndex(0);
            }),
      },
    ]);

  const onLogin = async () => {
    if (busy) return;
    if (!esercente.codeValid) return fail('password', MISSING_CODE_MESSAGE);
    setBusy(true);
    try {
      const { cliente } = await signInWithPassword(email, password, esercente.codEsercente);
      signIn(cliente);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const pickCode = (c: string, n?: string) => {
    esercente.setCode(c, n);
    clear('password');
    clear('account');
  };

  // elenco ancora in lettura: niente schermata che poi cambia
  if (!cod && saved === null) return null;

  const codParams = esercente.codEsercente ? { cod: esercente.codEsercente } : {};
  const esercenteName = esercente.linkName ?? esercente.name;
  const next = () => setPageIndex(pageIndex + 1);

  const titles: Record<Page, [string, string]> = {
    account: ['Bentornato', 'Scegli con quale account entrare'],
    esercente: ["Scegli l'esercente", 'Scansiona il QR o inserisci il codice'],
    credenziali: ['Bentornato', esercenteName ? `Accedi a ${esercenteName}` : 'Accedi per continuare'],
  };

  return (
    <AuthScreen
      page={pageIndex}
      step={Math.max(0, dots.indexOf(page))}
      steps={page === 'account' ? 1 : dots.length}
      showLogo={page !== 'esercente'}
      onBack={pageIndex > 0 ? () => setPageIndex(pageIndex - 1) : undefined}
      title={titles[page][0]}
      subtitle={titles[page][1]}
      action={
        page === 'credenziali' ? (
          <Button title="Accedi" onPress={onLogin} loading={busy} disabled={!email.trim() || !password} />
        ) : page === 'esercente' ? (
          <Button title="Continua" onPress={next} disabled={!esercente.codeValid} />
        ) : (
          <Button title={Platform.OS === 'ios' ? 'Accedi con Face ID' : 'Accedi con impronta'} onPress={onEnter} loading={busy} disabled={!selected} />
        )
      }>
      {page === 'account' && (
        <>
          {saved?.map((a) => {
            const active = accountKey(a) === selected;
            return (
              <View key={accountKey(a)} style={[styles.account, { borderColor: active ? t.primary : t.border }]}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${a.ragioneSociale}, ${a.email}`}
                  onPress={() => setSelected(accountKey(a))}
                  style={styles.accountMain}>
                  <View style={styles.accountText}>
                    <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                      {a.ragioneSociale}
                    </Text>
                    <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={1}>
                      {a.email}
                    </Text>
                  </View>
                  {active && <Check size={20} color={t.primary} strokeWidth={3} />}
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Rimuovi account dal telefono" hitSlop={8} onPress={() => onForget(a)} style={styles.accountRemove}>
                  <X size={18} color={t.textSecondary} />
                </Pressable>
              </View>
            );
          })}
          {errors.account && <Text style={{ color: t.danger, fontSize: 13, fontWeight: '500', textAlign: 'center' }}>{errors.account}</Text>}
          <Pressable accessibilityRole="button" onPress={next} style={({ pressed }) => [styles.other, { opacity: pressed ? 0.5 : 1 }]}>
            <Plus size={18} color={t.primary} strokeWidth={2.4} />
            <Text style={{ color: t.primary, fontWeight: '600' }}>Usa un altro account</Text>
          </Pressable>
        </>
      )}
      {page === 'esercente' && (
        <>
          <SavedEsercenti selected={esercente.code} onSelect={pickCode} />
          <EsercenteCodeField code={esercente.code} name={esercente.name} onChange={pickCode} />
        </>
      )}
      {page === 'credenziali' && (
        <>
          <TextField
            label="Email"
            placeholder="nome@esempio.it"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setRejected(false);
            }}
          />
          <TextField
            inputRef={passwordRef}
            label="Password"
            placeholder="Password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={() => email.trim() && password && onLogin()}
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              clear('password');
            }}
            error={errors.password ?? esercente.linkError}
            shakeKey={shakeFor('password')}
          />
          {rejected && (
            <Link href={{ pathname: '/forgot-password', params: { mode: 'conferma', email, ...codParams } } as never} style={{ color: t.primary, fontWeight: '600', textAlign: 'center' }}>
              Non hai ricevuto l&apos;email di conferma?
            </Link>
          )}
          <Link href={{ pathname: '/forgot-password', params: { email, ...codParams } } as never} style={{ color: t.textSecondary, textAlign: 'center' }}>
            Password dimenticata?
          </Link>
        </>
      )}
      <View style={styles.footer}>
        <Text style={{ color: t.textSecondary }}>Non hai un account? </Text>
        <Link href={{ pathname: '/register', params: cod ? { cod } : {} } as never} style={{ color: t.primary, fontWeight: '600' }}>
          Registrati
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', paddingTop: 8 },
  account: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 16 },
  accountMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 16, paddingVertical: 12, paddingRight: 4 },
  accountText: { flex: 1, gap: 2 },
  accountRemove: { padding: 16 },
  other: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12 },
});
