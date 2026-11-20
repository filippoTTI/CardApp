import * as Haptics from 'expo-haptics';
import { ChevronDown, Gift, QrCode as QrIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/glass-panel';
import { QrCode } from '@/components/ui/qr-code';
import { euroFormat, numberFormat } from '@/constants/format';
import { Radius } from '@/constants/theme';
import { useBackgroundFocus } from '@/context/background-focus';
import { useTheme } from '@/hooks/use-theme';
import { boostBrightness, restoreBrightness } from '@/services/brightness';
import { thresholdProgress } from '@/services/cards';
import { buildThresholdQrPayload } from '@/services/qr';
import type { Card, CardThreshold, CardThresholds } from '@/types/card';

/** Pagina del dettaglio aperto di una soglia raggiunta: 0 = dettagli, 1 = QR del premio. */
type DetailPage = 0 | 1;

export function formatThresholdValue(value: number, type: CardThresholds['type']): string {
  return type === 'euro' ? euroFormat.format(value) : `${numberFormat.format(value)} punti`;
}

/** Riga di dettaglio della soglia aperta: etichetta a sinistra, valore a destra. */
function DetailLine({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useTheme();
  return (
    <View style={styles.detailLine}>
      <Text style={{ color: t.textSecondary, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: color ?? t.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}

/** Finché il QR di un premio è visibile: luminosità al massimo e sfondo sfumato, come per la card girata. */
function useQrFocus(visible: boolean) {
  const { setCardFlipped } = useBackgroundFocus();
  useEffect(() => {
    if (!visible) return;
    setCardFlipped(true);
    boostBrightness();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    return () => {
      setCardFlipped(false);
      restoreBrightness();
    };
  }, [visible, setCardFlipped]);
}

function ThresholdRow({
  card,
  threshold,
  type,
  current,
  open,
  page,
  onToggle,
  onShowQr,
  onPageChange,
  last,
}: {
  card: Card;
  threshold: CardThreshold;
  type: CardThresholds['type'];
  current: number | undefined;
  open: boolean;
  page: DetailPage;
  onToggle: () => void;
  onShowQr: () => void;
  onPageChange: (page: DetailPage) => void;
  last: boolean;
}) {
  const t = useTheme();
  const reached = current !== undefined && current >= threshold.amount;
  // il premio si riscatta con il suo QR solo se la card non è bloccata
  const canRedeem = reached && !card.blocked;
  const ratio = current === undefined ? 0 : Math.min(1, current / threshold.amount);
  // nota sotto la barra solo per le soglie da raggiungere: per quelle raggiunte bastano icona e barra piena
  const status = !reached && current !== undefined ? `Ti mancano ${formatThresholdValue(threshold.amount - current, type)}` : undefined;

  const [pagerWidth, setPagerWidth] = useState(0);
  const [detailsHeight, setDetailsHeight] = useState(0);
  const pager = useRef<ScrollView>(null);
  const qrVisible = open && canRedeem && page === 1;
  useQrFocus(qrVisible);

  // la pagina richiesta (tocco sull'icona QR o sui dettagli) si raggiunge scorrendo il pager
  useEffect(() => {
    if (open && canRedeem && pagerWidth > 0) pager.current?.scrollTo({ x: page * pagerWidth, animated: true });
  }, [open, canRedeem, page, pagerWidth]);

  const onPagerLayout = (e: LayoutChangeEvent) => setPagerWidth(Math.round(e.nativeEvent.layout.width));
  const onPagerScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pagerWidth <= 0) return;
    const next: DetailPage = e.nativeEvent.contentOffset.x > pagerWidth / 2 ? 1 : 0;
    if (next !== page) onPageChange(next);
  };

  const details = (
    <View style={styles.detailsBody} onLayout={(e) => setDetailsHeight(Math.round(e.nativeEvent.layout.height))}>
      <DetailLine label="Premio" value={threshold.reward ?? 'Premio dell’esercente'} />
      <DetailLine label="Soglia" value={formatThresholdValue(threshold.amount, type)} />
      {current !== undefined && (
        <DetailLine label={type === 'euro' ? 'Saldo attuale' : 'Punti attuali'} value={formatThresholdValue(current, type)} />
      )}
      {current !== undefined && (
        <DetailLine
          label="Stato"
          value={reached ? 'Raggiunta' : `Mancano ${formatThresholdValue(threshold.amount - current, type)}`}
          color={reached ? t.primary : undefined}
        />
      )}
      <Text
        style={{
          color: canRedeem ? t.primary : t.textSecondary,
          fontSize: 12,
          marginTop: 4,
          fontWeight: canRedeem ? '600' : '400',
          textAlign: 'center',
        }}>
        {card.blocked
          ? 'La card è bloccata: sbloccala per riscattare il premio.'
          : reached
            ? 'Scorri o tocca Codice QR per riscattare il premio in cassa.'
            : type === 'euro'
              ? 'Raggiunto l’importo potrai riscattare il premio in cassa.'
              : 'Raggiunti i punti potrai riscattare il premio in cassa.'}
      </Text>
      {canRedeem && <Button title="Codice QR" onPress={() => onPageChange(1)} style={styles.qrButton} />}
    </View>
  );

  // il QR sta nell'altezza della pagina dettagli (riquadro 24 + spazio 8 + nota ~34): il pannello aperto non si allunga
  const QR_EXTRA = 24 + 8 + 34;
  const qrByHeight = detailsHeight > 0 ? detailsHeight - QR_EXTRA : Infinity;
  const qrSize = Math.max(120, Math.min(184, pagerWidth - 24, qrByHeight));

  return (
    <Animated.View layout={LinearTransition.duration(250)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Mostra i dettagli della soglia"
        onPress={onToggle}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.headerRow}>
          {canRedeem ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mostra il QR del premio"
              hitSlop={8}
              onPress={onShowQr}
              style={({ pressed }) => [styles.tile, { backgroundColor: t.primary, opacity: pressed ? 0.7 : 1 }]}>
              <QrIcon size={18} color={t.primaryText} strokeWidth={2.4} />
            </Pressable>
          ) : (
            <View style={[styles.tile, { backgroundColor: t.border }]}>
              <Gift size={18} color={t.textSecondary} strokeWidth={2.2} />
            </View>
          )}
          <View style={styles.body}>
            <View style={styles.header}>
              {/* chiusa il testo del buono si tronca; aperta si legge per intero */}
              <Text style={[styles.reward, { color: t.text }]} numberOfLines={open ? undefined : 1}>
                {threshold.reward ?? 'Premio'}
              </Text>
              <Text style={[styles.amount, { color: t.text }]} numberOfLines={1}>
                {formatThresholdValue(threshold.amount, type)}
              </Text>
              <ChevronDown size={18} color={t.textSecondary} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
            </View>
            {current !== undefined && (
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: threshold.amount, now: Math.min(current, threshold.amount) }}
                style={[styles.track, { backgroundColor: t.border }]}>
                <View style={[styles.fill, { backgroundColor: t.primary, width: `${ratio * 100}%` }]} />
              </View>
            )}
            {status && (
              <Text style={[styles.note, { color: t.textSecondary }]} numberOfLines={1}>
                {status}
              </Text>
            )}
          </View>
        </View>

        {/* il dettaglio aperto occupa tutta la larghezza della riga, centrato nel pannello */}
        {open && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={[styles.details, { borderTopColor: t.border }]}>
            {canRedeem ? (
              // premio riscattabile: dettagli e QR su due pagine, con swipe verso sinistra si passa al QR
              <View onLayout={onPagerLayout}>
                {pagerWidth > 0 && (
                  <>
                    <ScrollView
                      ref={pager}
                      horizontal
                      pagingEnabled
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      contentOffset={{ x: page * pagerWidth, y: 0 }}
                      onMomentumScrollEnd={onPagerScrollEnd}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityHint="Mostra il QR del premio"
                        onPress={() => onPageChange(1)}
                        style={{ width: pagerWidth }}>
                        {details}
                      </Pressable>
                      {/* il tocco sul QR non chiude la soglia: in cassa il QR deve restare aperto */}
                      <Pressable
                        accessible
                        accessibilityLabel={`QR del premio ${threshold.reward ?? ''}`.trim()}
                        onPress={() => {}}
                        style={[styles.qrPage, { width: pagerWidth }]}>
                        <View style={styles.qrBox}>
                          <QrCode value={buildThresholdQrPayload(card, threshold)} size={qrSize} />
                        </View>
                        <Text style={[styles.qrHint, { color: t.textSecondary }]}>Mostra questo QR in cassa per riscattare il premio.</Text>
                      </Pressable>
                    </ScrollView>
                    <View style={styles.dots}>
                      {([0, 1] as const).map((p) => (
                        <View key={p} style={[styles.dot, { backgroundColor: page === p ? t.primary : t.border }]} />
                      ))}
                    </View>
                  </>
                )}
              </View>
            ) : (
              details
            )}
          </Animated.View>
        )}
      </Pressable>
      {!last && <View style={[styles.separator, { backgroundColor: t.border }]} />}
    </Animated.View>
  );
}

/**
 * Sezione "Soglie premio": per ogni soglia il buono, il valore da raggiungere e l'avanzamento del saldo; toccando una
 * soglia si apre (una alla volta) con il testo completo del buono e i dettagli. Una soglia raggiunta (su card non
 * bloccata) ha il proprio QR da mostrare in cassa: si apre toccando l'icona QR, scorrendo i dettagli verso sinistra o
 * toccandoli. Senza il contatore dello stesso tipo le soglie non hanno avanzamento.
 */
export function CardThresholdsSection({ card }: { card: Card }) {
  const t = useTheme();
  const [open, setOpen] = useState<{ index: number; page: DetailPage }>();
  const thresholds = card.thresholds;
  if (!thresholds) return null;
  const current = thresholdProgress(card);

  return (
    <View>
      <Text style={[styles.section, { color: t.textSecondary }]}>Soglie premio</Text>
      <GlassPanel radius={Radius.lg}>
        {thresholds.items.map((s, i) => (
          <ThresholdRow
            key={`${s.amount}-${i}`}
            card={card}
            threshold={s}
            type={thresholds.type}
            current={current}
            open={open?.index === i}
            page={open?.index === i ? open.page : 0}
            onToggle={() => setOpen((v) => (v?.index === i ? undefined : { index: i, page: 0 }))}
            // sull'icona QR: apre direttamente il QR; se è già aperto lo richiude
            onShowQr={() => setOpen((v) => (v?.index === i && v.page === 1 ? undefined : { index: i, page: 1 }))}
            onPageChange={(page) => setOpen({ index: i, page })}
            last={i === thresholds.items.length - 1}
          />
        ))}
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { paddingHorizontal: 22, paddingVertical: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  tile: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reward: { flex: 1, fontSize: 16, fontWeight: '600' },
  amount: { fontSize: 15, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  note: { fontSize: 12 },
  details: { paddingTop: 12, marginTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  detailsBody: { gap: 6 },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  // il QR resta nero su bianco (come sul retro della card) per essere letto in cassa con qualsiasi tema
  qrPage: { alignItems: 'center', gap: 8 },
  qrBox: { padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF' },
  qrButton: { height: 44, marginTop: 6, alignSelf: 'stretch' },
  qrHint: { fontSize: 12, textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 18 },
});
