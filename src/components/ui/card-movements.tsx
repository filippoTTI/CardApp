import { Minus, Plus, Star, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { GlassPanel } from '@/components/ui/glass-panel';
import SkeletonLoading from '@/components/ui/skeleton-loading';
import { euroFormat, formatDateTime, numberFormat } from '@/constants/format';
import { Radius } from '@/constants/theme';
import { SkeletonShimmerProvider } from '@/context/skeleton-shimmer';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/services/api';
import { fetchMovements } from '@/services/cards';
import type { CardMovement, CounterType } from '@/types/card';

const KIND_STYLE: Record<CardMovement['kind'], { Icon: LucideIcon; tile: string; label: string }> = {
  recharge: { Icon: Plus, tile: '#22C55E', label: 'Ricarica' },
  expense: { Icon: Minus, tile: '#EF4444', label: 'Spesa' },
  credit: { Icon: Star, tile: '#F59E0B', label: 'Accredito' },
};

/** Importo con il simbolo del contatore (euro, punti, percentuale di sconto). */
function formatAmount(value: number, counter: CounterType, signed: boolean): string {
  const sign = signed && value > 0 ? '+' : '';
  switch (counter) {
    case 'euro':
      return `${sign}${euroFormat.format(value)}`;
    case 'points':
      return `${sign}${numberFormat.format(value)} punti`;
    case 'discount':
      return `${sign}${numberFormat.format(value)}%`;
    default:
      return `${sign}${numberFormat.format(value)}`;
  }
}

function MovementRow({ movement, last }: { movement: CardMovement; last: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const { Icon, tile, label } = KIND_STYLE[movement.kind];
  const expandable = movement.lines.length > 0 || !!movement.document || !!movement.circuit || !!movement.slaveCode;

  return (
    <View>
      <Pressable accessibilityRole={expandable ? 'button' : undefined} disabled={!expandable} onPress={() => setOpen((v) => !v)} style={styles.row}>
        <View style={[styles.tile, { backgroundColor: tile }]}>
          <Icon size={18} color="#FFFFFF" strokeWidth={2.4} />
        </View>
        <View style={styles.rowText}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
            {movement.description ?? label}
          </Text>
          <Text style={{ color: t.textSecondary, fontSize: 12 }} numberOfLines={1}>
            {`${formatDateTime(movement.dateTime)} · ${movement.merchant}`}
          </Text>
        </View>
        <View style={styles.rowValue}>
          <Text style={{ color: movement.amount > 0 ? '#22C55E' : t.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
            {formatAmount(movement.amount, movement.counter, true)}
          </Text>
          <Text style={{ color: t.textSecondary, fontSize: 12 }} numberOfLines={1}>
            {`Saldo ${formatAmount(movement.balanceAfter, movement.counter, false)}`}
          </Text>
        </View>
      </Pressable>

      {open && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.details}>
          <Text style={{ color: t.textSecondary, fontSize: 13 }}>{movement.merchant}</Text>
          {movement.document ? <Text style={{ color: t.textSecondary, fontSize: 13 }}>{`Documento ${movement.document}`}</Text> : null}
          {movement.circuit ? <Text style={{ color: t.textSecondary, fontSize: 13 }}>{`Circuito ${movement.circuit}`}</Text> : null}
          {movement.slaveCode ? <Text style={{ color: t.textSecondary, fontSize: 13 }}>{`Eseguito con la card ${movement.slaveCode}`}</Text> : null}
          {movement.lines.map((line, i) => (
            <View key={i} style={styles.line}>
              <Text style={{ color: t.text, fontSize: 14, flex: 1 }} numberOfLines={1}>
                {`${numberFormat.format(line.quantity)}${line.unit ? ` ${line.unit}` : ''} ${line.description ?? ''}`.trim()}
              </Text>
              <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }}>{euroFormat.format(line.total)}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {!last && <View style={[styles.separator, { backgroundColor: t.border }]} />}
    </View>
  );
}

const SKELETON_ROWS = 3;

/** Riga segnaposto con la stessa sagoma di un movimento, mostrata solo al primo caricamento. */
function SkeletonRow({ last }: { last: boolean }) {
  const t = useTheme();
  const dark = useColorScheme() === 'dark';
  const colors = dark ? { baseColor: 'rgba(255,255,255,0.07)', highlightColor: 'rgba(255,255,255,0.15)' } : { baseColor: 'rgba(6,40,22,0.06)', highlightColor: 'rgba(255,255,255,0.65)' };
  return (
    <View>
      <View style={styles.row}>
        <SkeletonLoading width={36} height={36} borderRadius={14} {...colors} />
        <View style={styles.rowText}>
          <SkeletonLoading width="70%" height={14} borderRadius={7} {...colors} />
          <SkeletonLoading width="45%" height={10} borderRadius={5} {...colors} style={styles.skeletonGap} />
        </View>
        <SkeletonLoading width={64} height={16} borderRadius={8} {...colors} />
      </View>
      {!last && <View style={[styles.separator, { backgroundColor: t.border }]} />}
    </View>
  );
}

/**
 * Elenco dei movimenti di una card (ricariche, spese, accrediti), dal più recente, con paginazione.
 * Al primo caricamento mostra righe segnaposto; gli aggiornamenti (`refreshKey`) avvengono senza svuotare l'elenco,
 * che viene sostituito solo quando arrivano i dati nuovi. Le risposte arrivate fuori tempo vengono ignorate.
 */
export function CardMovements({ accountKey, cardId, refreshKey = 0 }: { accountKey: string; cardId: string; refreshKey?: number }) {
  const t = useTheme();
  const [items, setItems] = useState<CardMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // `more`: è fallito il caricamento della pagina successiva; `first`: quello della prima pagina (apertura o aggiornamento)
  const [error, setError] = useState<{ message: string; source: 'first' | 'more' }>();
  const [retryKey, setRetryKey] = useState(0);
  // ogni richiesta ha un numero: vale solo la risposta dell'ultima (un aggiornamento annulla un "mostra altri" in corso)
  const request = useRef(0);

  // prima pagina all'apertura e a ogni aggiornamento
  useEffect(() => {
    const id = ++request.current;
    fetchMovements(accountKey, cardId, 1)
      .then((res) => {
        if (id !== request.current) return;
        setItems(res.movements);
        setTotal(res.total);
        setPage(1);
        setError(undefined);
      })
      .catch((e) => {
        if (id === request.current) setError({ message: errorMessage(e), source: 'first' });
      })
      .finally(() => {
        if (id !== request.current) return;
        setInitialLoading(false);
        setLoadingMore(false);
      });
  }, [accountKey, cardId, refreshKey, retryKey]);

  // all'uscita dalla schermata le risposte in arrivo non devono più aggiornare nulla
  useEffect(
    () => () => {
      request.current += 1;
    },
    [],
  );

  const loadMore = async () => {
    if (loadingMore || initialLoading) return;
    const id = ++request.current;
    setLoadingMore(true);
    try {
      const res = await fetchMovements(accountKey, cardId, page + 1);
      if (id !== request.current) return;
      // un movimento già mostrato (es. arrivato un nuovo movimento che ha fatto scorrere le pagine) non si duplica
      setItems((prev) => [...prev, ...res.movements.filter((m) => !prev.some((p) => p.id === m.id))]);
      setTotal(res.total);
      setPage(page + 1);
      setError(undefined);
    } catch (e) {
      if (id === request.current) setError({ message: errorMessage(e), source: 'more' });
    } finally {
      if (id === request.current) setLoadingMore(false);
    }
  };

  const retry = () => {
    if (error?.source === 'more') {
      void loadMore();
      return;
    }
    // senza movimenti già mostrati si torna ai segnaposto; altrimenti l'elenco resta finché non arrivano i dati nuovi
    if (items.length === 0) setInitialLoading(true);
    setError(undefined);
    setRetryKey((k) => k + 1);
  };

  const hasMore = items.length > 0 && items.length < total;

  return (
    <View>
      <Text style={[styles.section, { color: t.textSecondary }]}>Movimenti</Text>
      <GlassPanel radius={Radius.lg}>
        {initialLoading ? (
          <SkeletonShimmerProvider>
            {Array.from({ length: SKELETON_ROWS }, (_, i) => (
              <SkeletonRow key={i} last={i === SKELETON_ROWS - 1} />
            ))}
          </SkeletonShimmerProvider>
        ) : (
          <Animated.View entering={FadeIn.duration(300)} layout={LinearTransition.duration(250)}>
            {items.map((m, i) => (
              <Animated.View key={m.id} entering={FadeIn.duration(250)} layout={LinearTransition.duration(250)}>
                <MovementRow movement={m} last={i === items.length - 1 && !hasMore} />
              </Animated.View>
            ))}

            {items.length === 0 && !error && <Text style={[styles.message, { color: t.textSecondary }]}>Nessun movimento</Text>}

            {error && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
                <Text style={[styles.errorText, { color: items.length > 0 ? t.danger : t.textSecondary }]}>{error.message}</Text>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={loadingMore}
                  onPress={retry}
                  style={({ pressed }) => ({ opacity: pressed || loadingMore ? 0.6 : 1 })}>
                  <Text style={{ color: t.primary, fontSize: 15, fontWeight: '600' }}>Riprova</Text>
                </Pressable>
              </Animated.View>
            )}

            {hasMore && !error && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ busy: loadingMore }}
                disabled={loadingMore}
                onPress={loadMore}
                style={({ pressed }) => [styles.more, { opacity: pressed ? 0.6 : 1 }]}>
                {loadingMore ? (
                  <ActivityIndicator size="small" color={t.primary} />
                ) : (
                  <Text style={{ color: t.primary, fontSize: 15, fontWeight: '600' }}>{`Mostra altri (${total - items.length})`}</Text>
                )}
              </Pressable>
            )}
          </Animated.View>
        )}
      </GlassPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 22 },
  tile: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowValue: { alignItems: 'flex-end', gap: 2, maxWidth: '45%' },
  details: { paddingHorizontal: 22, paddingBottom: 22, paddingLeft: 72, gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 18 },
  message: { textAlign: 'center', paddingVertical: 18, fontSize: 14 },
  errorBox: { alignItems: 'center', gap: 10, paddingVertical: 18, paddingHorizontal: 22 },
  errorText: { textAlign: 'center', fontSize: 14 },
  skeletonGap: { marginTop: 6 },
  more: { alignItems: 'center', justifyContent: 'center', height: 58 },
});
