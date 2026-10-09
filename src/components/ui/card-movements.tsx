import { Minus, Plus, Star, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassPanel } from '@/components/ui/glass-panel';
import { euroFormat, formatDateTime, numberFormat } from '@/constants/format';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
        <View style={styles.details}>
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
        </View>
      )}

      {!last && <View style={[styles.separator, { backgroundColor: t.border }]} />}
    </View>
  );
}

/** Elenco dei movimenti di una card (ricariche, spese, accrediti), dal più recente, con paginazione. */
export function CardMovements({ accountKey, cardId, refreshKey = 0 }: { accountKey: string; cardId: string; refreshKey?: number }) {
  const t = useTheme();
  const [items, setItems] = useState<CardMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  // prima pagina all'apertura della schermata
  useEffect(() => {
    let active = true;
    fetchMovements(accountKey, cardId, 1)
      .then((res) => {
        if (!active) return;
        setItems(res.movements);
        setTotal(res.total);
        setPage(1);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Errore imprevisto');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountKey, cardId, refreshKey]);

  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetchMovements(accountKey, cardId, page + 1);
      setItems((prev) => [...prev, ...res.movements]);
      setTotal(res.total);
      setPage(page + 1);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore imprevisto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text style={[styles.section, { color: t.textSecondary }]}>Movimenti</Text>
      <GlassPanel radius={Radius.lg}>
        {items.map((m, i) => (
          <MovementRow key={m.id} movement={m} last={i === items.length - 1} />
        ))}

        {items.length === 0 && !loading && (
          <Text style={[styles.message, { color: t.textSecondary }]}>{error ?? 'Nessun movimento'}</Text>
        )}
        {loading && <ActivityIndicator style={styles.loader} color={t.textSecondary} />}

        {items.length > 0 && items.length < total && !loading && (
          <Pressable accessibilityRole="button" onPress={loadMore} style={styles.more}>
            <Text style={{ color: t.primary, fontSize: 15, fontWeight: '600' }}>Mostra altri</Text>
          </Pressable>
        )}
        {items.length > 0 && error ? <Text style={[styles.message, { color: t.danger }]}>{error}</Text> : null}
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
  loader: { paddingVertical: 18 },
  more: { alignItems: 'center', paddingVertical: 18 },
});
