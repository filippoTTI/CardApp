import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { Button } from '@/components/ui/button';
import { QrScanner } from '@/components/ui/qr-scanner';
import { ResultBadge } from '@/components/ui/result-badge';
import { useAppLock, withoutLock } from '@/context/app-lock';
import { paletteFromColor } from '@/constants/card-color';
import { CARD_KIND_LABEL, euroFormat, euroLabel } from '@/constants/format';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/services/api';
import { authenticateBiometric } from '@/services/biometric';
import { pickCounter } from '@/services/cards';
import { fetchPaymentRequest, parsePaymentQr, payPaymentRequest, PAYMENT_STATUS_MESSAGE, type PaymentRequest } from '@/services/pagamento-qr';
import type { Card } from '@/types/card';

type Phase =
  | { step: 'scan' }
  | { step: 'loading' }
  | { step: 'choose'; request: PaymentRequest; options: Card[] }
  | { step: 'confirm'; request: PaymentRequest; card: Card; notice?: string }
  | { step: 'paying'; request: PaymentRequest; card: Card }
  | { step: 'done'; request: PaymentRequest }
  | { step: 'error'; message: string };

const NO_CARD = 'Nessuna delle tue card può pagare presso questo esercente';

/** Card con cui si può pagare in cassa: prepagate e sbloccate (il saldo non conta, la cassa decide). */
const canPayWith = (c: Card) => c.kind === 'prepaid' && !c.blocked;

/** Codice esercente dell'account da cui arriva la card (la chiave account è `CODICE|email`). */
const merchantOf = (key: string) => key.split('|')[0].toUpperCase();

/**
 * Pagamento in cassa con la card: inquadra il QR che la cassa mostra (`cardapp://pay/<id>?e=<esercente>`) e l'app sceglie da sola
 * le card compatibili, cioè le prepagate sbloccate dell'esercente che incassa. Con una sola card va direttamente alla conferma,
 * con più card chiede quale usare. La conferma identifica la card: credito, punti e sconti li gestisce la cassa con il suo flusso
 * normale, quindi il saldo si aggiorna poco dopo. `onPaid` viene chiamato dopo la conferma (con un po' di ritardo, per lasciare
 * alla cassa il tempo di scalare) e serve a ricaricare i saldi.
 */
export function PayWithQr({ cards, visible, onClose, onPaid }: { cards: Card[]; visible: boolean; onClose: () => void; onPaid: () => void }) {
  const t = useTheme();
  const { biometricEnabled } = useAppLock();
  const [phase, setPhase] = useState<Phase>({ step: 'scan' });

  // alla chiusura si torna alla fotocamera, così la prossima apertura riparte da capo
  const close = () => {
    setPhase({ step: 'scan' });
    onClose();
  };

  // con un server aggiornato la risposta indica le card del cliente utilizzabili per questa richiesta
  const onlyValid = (cards: Card[], request: PaymentRequest) => {
    const valid = request.validCards;
    return valid ? cards.filter((c) => valid.includes(Number(c.id))) : cards;
  };

  // letta la richiesta si decide la card: nessuna compatibile = errore, una sola = conferma, più di una = scelta
  const proceed = (request: PaymentRequest, options: Card[]) => {
    if (request.status !== 0) setPhase({ step: 'error', message: PAYMENT_STATUS_MESSAGE[request.status] });
    else if (options.length === 0) setPhase({ step: 'error', message: NO_CARD });
    else if (options.length === 1) setPhase({ step: 'confirm', request, card: options[0] });
    else setPhase({ step: 'choose', request, options });
  };

  const onCode = (text: string) => {
    const qr = parsePaymentQr(text);
    if (!qr) return;
    setPhase({ step: 'loading' });
    const usable = cards.filter(canPayWith);

    // cassa in modalita' esercente: il QR indica l'esercente e si usano subito le sue card, senza tentativi
    if (qr.codEsercente && !qr.circuit) {
      const options = usable.filter((c) => merchantOf(c.accountKey ?? '') === qr.codEsercente);
      if (options.length === 0) {
        setPhase({ step: 'error', message: NO_CARD });
        return;
      }
      fetchPaymentRequest(options[0].accountKey ?? '', qr.id)
        .then((request) => proceed(request, onlyValid(options, request)))
        .catch((e) => setPhase({ step: 'error', message: errorMessage(e) }));
      return;
    }

    // circuito (o QR senza esercente): la card puo' stare in un account di un altro esercente. Si chiede la richiesta a ogni account:
    // il server risponde solo a quelli del circuito e indica quali card del cliente sono valide, l'app propone solo quelle
    void (async () => {
      const keys = [...new Set(usable.map((c) => c.accountKey ?? ''))].sort(
        (a, b) => Number(merchantOf(b) === qr.codEsercente) - Number(merchantOf(a) === qr.codEsercente),
      );
      const found: { key: string; request: PaymentRequest }[] = [];
      let lastError = NO_CARD;
      for (const key of keys) {
        try {
          found.push({ key, request: await fetchPaymentRequest(key, qr.id) });
        } catch (e) {
          lastError = errorMessage(e);
        }
      }
      if (found.length === 0) {
        setPhase({ step: 'error', message: lastError });
        return;
      }
      // senza circuito basta il primo account che risponde; in circuito si sommano le card valide di tutti gli account
      const chosen = qr.circuit || found[0].request.circuit ? found : found.slice(0, 1);
      const options = chosen.flatMap((f) =>
        onlyValid(
          usable.filter((c) => c.accountKey === f.key),
          f.request,
        ),
      );
      proceed(chosen[0].request, options);
    })();
  };

  const pay = async (request: PaymentRequest, card: Card) => {
    // con lo sblocco biometrico attivo il pagamento va confermato con Face ID / impronta
    if (biometricEnabled) {
      const ok = await withoutLock(() => authenticateBiometric('Conferma il pagamento'));
      if (!ok) {
        setPhase({ step: 'confirm', request, card, notice: 'Conferma con la biometria non riuscita: il pagamento non è stato eseguito' });
        return;
      }
    }
    setPhase({ step: 'paying', request, card });
    payPaymentRequest(card.accountKey ?? '', request.id, card.id)
      .then(() => {
        setPhase({ step: 'done', request });
        setTimeout(onPaid, 5000);
      })
      .catch((e) => setPhase({ step: 'error', message: errorMessage(e) }));
  };

  if (phase.step === 'scan') {
    return (
      <QrScanner
        visible={visible}
        onClose={close}
        onCode={onCode}
        parse={(data) => (parsePaymentQr(data) ? data : null)}
        hint="Inquadra il QR mostrato in cassa"
        invalidHint="Questo QR non è un pagamento CardApp"
      />
    );
  }

  const busy = phase.step === 'paying' || phase.step === 'loading';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => !busy && close()} statusBarTranslucent>
      <SafeAreaProvider>
        <View style={[styles.fill, { backgroundColor: t.background }]}>
          <AnimatedBackground variant="calm" />
          <SafeAreaView style={styles.fill}>
            <View style={styles.topBar}>
              {(phase.step === 'choose' || phase.step === 'confirm') && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Annulla"
                  hitSlop={10}
                  onPress={close}
                  style={[styles.close, { backgroundColor: t.card, borderColor: t.border }]}>
                  <X size={20} color={t.text} strokeWidth={2.2} />
                </Pressable>
              )}
            </View>

            <View style={styles.body}>
              {phase.step === 'loading' && (
                <Animated.View entering={FadeIn.duration(250)} style={styles.center}>
                  <Spinner />
                  <Text style={[Type.heading, styles.centerText, { color: t.text }]}>Lettura del pagamento</Text>
                  <Text style={[Type.body, styles.centerText, { color: t.textSecondary }]}>Un momento, controllo la richiesta della cassa</Text>
                </Animated.View>
              )}

              {(phase.step === 'choose' || phase.step === 'confirm' || phase.step === 'paying') && (
                <Animated.View entering={FadeInDown.duration(420)} style={styles.hero}>
                  <View style={[styles.avatar, { backgroundColor: `${t.primary}26` }]}>
                    <Text style={[Type.section, { color: t.primary }]}>{initials(phase.request.merchant)}</Text>
                  </View>
                  <Text style={[Type.caption, { color: t.textSecondary }]}>Paga a</Text>
                  <Text numberOfLines={2} style={[Type.heading, styles.centerText, { color: t.text }]}>
                    {phase.request.merchant}
                  </Text>
                  <Text adjustsFontSizeToFit numberOfLines={1} style={[Type.display, styles.amount, { color: t.text }]}>
                    {euroFormat.format(phase.request.amount)}
                  </Text>
                </Animated.View>
              )}

              {phase.step === 'choose' && (
                <Animated.View key="choose" entering={FadeInDown.delay(120).duration(420)} style={styles.section}>
                  <Text style={[Type.label, { color: t.textSecondary }]}>Scegli la card</Text>
                  <ScrollView style={styles.options} contentContainerStyle={styles.optionsList} showsVerticalScrollIndicator={false}>
                    {phase.options.map((c) => (
                      <CardTile
                        key={c.id}
                        card={c}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setPhase({ step: 'confirm', request: phase.request, card: c });
                        }}
                      />
                    ))}
                  </ScrollView>
                  <Button title="Annulla" variant="ghost" onPress={close} />
                </Animated.View>
              )}

              {(phase.step === 'confirm' || phase.step === 'paying') && (
                <Animated.View key="confirm" entering={FadeInDown.delay(120).duration(420)} style={styles.section}>
                  <Text style={[Type.label, { color: t.textSecondary }]}>Pagherai con</Text>
                  <CardTile card={phase.card} />
                  {phase.step === 'confirm' && phase.request.secondsLeft > 0 && (
                    <Countdown
                      seconds={phase.request.secondsLeft}
                      receivedAt={phase.request.receivedAt}
                      onExpire={() => setPhase({ step: 'error', message: PAYMENT_STATUS_MESSAGE[3] })}
                    />
                  )}
                  {phase.step === 'confirm' && phase.notice && (
                    <Animated.View entering={FadeIn.duration(250)} style={[styles.notice, { backgroundColor: `${t.danger}1A`, borderColor: `${t.danger}55` }]}>
                      <Text style={[Type.caption, { color: t.danger }]}>{phase.notice}</Text>
                    </Animated.View>
                  )}
                  <Button
                    title={`Paga ${euroFormat.format(phase.request.amount)}`}
                    loading={phase.step === 'paying'}
                    onPress={() => void pay(phase.request, phase.card)}
                  />
                  {phase.step === 'paying' ? (
                    <Text style={[Type.caption, styles.centerText, { color: t.textSecondary }]}>Conferma in corso, non chiudere questa schermata</Text>
                  ) : (
                    <Button title="Annulla" variant="ghost" onPress={close} />
                  )}
                </Animated.View>
              )}

              {phase.step === 'done' && (
                <View style={styles.center}>
                  <ResultBadge kind="success" />
                  <Animated.View entering={FadeInDown.delay(500).duration(420)} style={styles.center}>
                    <Text style={[Type.heading, styles.centerText, { color: t.text }]}>Pagamento confermato</Text>
                    <Text style={[Type.display, styles.amount, { color: t.text }]}>{euroFormat.format(phase.request.amount)}</Text>
                  </Animated.View>
                  <Animated.View entering={FadeInDown.delay(650).duration(420)} style={styles.receipt}>
                    <View style={[styles.receiptBox, { backgroundColor: t.card, borderColor: t.border }]}>
                      <Row label="Esercente" value={phase.request.merchant} />
                      <Row label="Data" value={new Date().toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })} />
                    </View>
                    <Text style={[Type.caption, styles.centerText, { color: t.textSecondary }]}>
                      La cassa sta completando il pagamento: il credito si aggiorna tra pochi secondi
                    </Text>
                  </Animated.View>
                  <Animated.View entering={FadeInDown.delay(800).duration(420)} style={styles.full}>
                    <Button title="Chiudi" onPress={close} />
                  </Animated.View>
                </View>
              )}

              {phase.step === 'error' && (
                <View style={styles.center}>
                  <ResultBadge kind="error" />
                  <Animated.View entering={FadeInDown.delay(500).duration(420)} style={styles.center}>
                    <Text style={[Type.heading, styles.centerText, { color: t.text }]}>Pagamento non riuscito</Text>
                    <Text style={[Type.body, styles.centerText, { color: t.textSecondary }]}>{phase.message}</Text>
                  </Animated.View>
                  <Animated.View entering={FadeInDown.delay(650).duration(420)} style={styles.full}>
                    <Button title="Riprova" onPress={() => setPhase({ step: 'scan' })} />
                    <Button title="Chiudi" variant="ghost" onPress={close} />
                  </Animated.View>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

/** Iniziali (max 2) del nome dell'esercente. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
}

/** Anello che ruota mentre si attende la risposta del server. */
function Spinner() {
  const t = useTheme();
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.set(withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1));
  }, [turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get()}deg` }] }));
  return <Animated.View style={[styles.spinner, { borderColor: `${t.primary}30`, borderTopColor: t.primary }, style]} />;
}

/** Tempo rimasto per pagare: testo e barra che si svuota; a zero chiama `onExpire`. */
function Countdown({ seconds, receivedAt, onExpire }: { seconds: number; receivedAt: number; onExpire: () => void }) {
  const t = useTheme();
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil(seconds - (Date.now() - receivedAt) / 1000)));
  const frac = useSharedValue(left / seconds);

  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil(seconds - (Date.now() - receivedAt) / 1000));
      setLeft(remaining);
      frac.set(withTiming(remaining / seconds, { duration: 1000, easing: Easing.linear }));
      if (remaining === 0) {
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [seconds, receivedAt, frac, onExpire]);

  const bar = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, frac.get())) * 100}%` }));
  const urgent = left <= 10;
  const color = urgent ? t.danger : t.primary;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, '0');
  return (
    <View style={styles.countdown} accessibilityLabel={`Scade tra ${left} secondi`}>
      <View style={styles.countdownRow}>
        <Text style={[Type.caption, { color: t.textSecondary }]}>Tempo per pagare</Text>
        <Text style={[Type.caption, { color, fontWeight: '700', fontVariant: ['tabular-nums'] }]}>
          {mm}:{ss}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: t.border }]}>
        <Animated.View style={[styles.fillBar, { backgroundColor: color }, bar]} />
      </View>
    </View>
  );
}

/** Riga con la card (miniatura nel colore dell'esercente, codice, tipo, credito); con `onPress` è una scelta. */
function CardTile({ card, onPress }: { card: Card; onPress?: () => void }) {
  const t = useTheme();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const palette = paletteFromColor(card.color, scheme);
  const colors: [string, string] = palette ? [palette.bgTop, palette.bgBottom] : scheme === 'dark' ? ['#1F5A3B', '#0F3320'] : ['#B5EBCF', '#6FD09B'];
  const credit = pickCounter(card.counters ?? [], 'euro')?.amount;
  const content = (
    <View style={[styles.tile, { backgroundColor: t.card, borderColor: t.border }]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch} />
      <View style={styles.tileText}>
        <Text style={[Type.section, { color: t.text }]}>{card.code}</Text>
        <Text style={[Type.caption, { color: t.textSecondary }]}>{CARD_KIND_LABEL[card.kind]}</Text>
      </View>
      {credit !== undefined && (
        <View style={styles.credit}>
          <Text style={[Type.label, { color: t.textSecondary }]}>{euroLabel(card.kind)}</Text>
          <Text style={[Type.section, { color: t.text }]}>{euroFormat.format(credit)}</Text>
        </View>
      )}
      {onPress && <ChevronRight size={20} color={t.textSecondary} strokeWidth={2} />}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Card ${card.code}`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[Type.caption, { color: t.textSecondary }]}>{label}</Text>
      <Text numberOfLines={1} style={[Type.body, { color: t.text, fontWeight: '600', flexShrink: 1 }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { height: 56, paddingHorizontal: Spacing.four, justifyContent: 'center', alignItems: 'flex-end' },
  close: { width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four + 4, gap: Spacing.four, paddingBottom: Spacing.four },
  center: { alignItems: 'center', gap: Spacing.three },
  centerText: { textAlign: 'center' },
  full: { alignSelf: 'stretch', gap: Spacing.two },
  hero: { alignItems: 'center', gap: Spacing.one },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  amount: { textAlign: 'center', marginTop: Spacing.two },
  section: { gap: Spacing.three - 4 },
  options: { flexGrow: 0, maxHeight: 280 },
  optionsList: { gap: Spacing.two + 2, paddingVertical: 2 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 2, padding: Spacing.three - 2, borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
  swatch: { width: 48, height: 32, borderRadius: 8 },
  tileText: { flex: 1, gap: 1 },
  credit: { alignItems: 'flex-end', gap: 1 },
  notice: { padding: Spacing.three - 4, borderRadius: Radius.sm - 4, borderWidth: StyleSheet.hairlineWidth },
  countdown: { gap: 6 },
  countdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fillBar: { height: 4, borderRadius: 2 },
  spinner: { width: 56, height: 56, borderRadius: 28, borderWidth: 4 },
  receipt: { alignSelf: 'stretch', gap: Spacing.three - 4 },
  receiptBox: { padding: Spacing.three, gap: Spacing.two + 2, borderRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.three },
});
