import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock, LockOpen } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { CardMovements } from '@/components/ui/card-movements';
import { FlipCard } from '@/components/ui/flip-card';
import { GlassPanel } from '@/components/ui/glass-panel';
import { IconButton } from '@/components/ui/icon-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { CARD_KIND_LABEL, euroFormat, formatDate, numberFormat } from '@/constants/format';
import { Radius } from '@/constants/theme';
import { useCards } from '@/context/cards';
import { useTheme } from '@/hooks/use-theme';
import { errorMessage } from '@/services/api';
import type { Card, CardCounter } from '@/types/card';

function formatCounter(c: CardCounter): { label: string; value: string } {
  switch (c.type) {
    case 'euro':
      return { label: 'Saldo', value: euroFormat.format(c.amount) };
    case 'points':
      return { label: 'Punti', value: numberFormat.format(c.amount) };
    case 'discount':
      return { label: 'Sconto', value: `${numberFormat.format(c.amount)}%` };
    case 'standard':
      return { label: 'Card standard', value: 'Nessun saldo' };
    default:
      return { label: 'Contatore', value: numberFormat.format(c.amount) };
  }
}

type Row = { label: string; value: string };

/** Righe informative della card: solo quelle con un valore. */
function infoRows(card: Card): Row[] {
  const rows: (Row | undefined)[] = [
    { label: 'Codice', value: card.code },
    { label: 'Tipo', value: CARD_KIND_LABEL[card.kind] },
    { label: 'Stato', value: card.blocked ? 'Bloccata' : 'Attiva' },
    card.issuer ? { label: 'Emessa da', value: card.issuer.city ? `${card.issuer.name} (${card.issuer.city})` : card.issuer.name } : undefined,
    card.reference ? { label: 'Riferimento', value: card.reference } : undefined,
    card.note ? { label: 'Note', value: card.note } : undefined,
    card.data ? { label: 'Dati', value: card.data } : undefined,
    card.masterCode ? { label: 'Card master', value: card.masterCode } : undefined,
    formatDate(card.createdAt) ? { label: 'Inserita il', value: formatDate(card.createdAt)! } : undefined,
    formatDate(card.lastUsedAt) ? { label: 'Ultimo utilizzo', value: formatDate(card.lastUsedAt)! } : undefined,
  ];
  return rows.filter((r): r is Row => r !== undefined);
}

export default function CardDetailsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, setBlocked, reload } = useCards();
  const card = cards.find((c) => c.id === id);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
  };

  const changeBlocked = (cardId: string, blocked: boolean) => {
    setBusy(true);
    setBlocked(cardId, blocked)
      .then((message) => {
        if (message) Alert.alert('Card', message);
      })
      .catch((e) => Alert.alert('Card', errorMessage(e)))
      .finally(() => setBusy(false));
  };

  // il blocco chiede conferma; lo sblocco è immediato
  const toggleBlocked = () => {
    if (!card || busy) return;
    if (card.blocked) {
      changeBlocked(card.id, false);
      return;
    }
    Alert.alert('Blocca card', 'La card non potrà essere usata finché non la sblocchi.', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Blocca', style: 'destructive', onPress: () => changeBlocked(card.id, true) },
    ]);
  };

  return (
    <View style={styles.flex}>
      <AnimatedBackground variant="rich" />
      <SafeAreaView edges={['top']} style={styles.flex}>
        <View style={styles.header}>
          <ScreenHeader
            title="Dettagli card"
            left={
              <IconButton label="Indietro" onPress={() => router.back()}>
                {(color) => <Ionicons name="chevron-back" size={24} color={color} />}
              </IconButton>
            }
          />
        </View>

        {!card ? (
          <View style={styles.empty}>
            <Text style={{ color: t.textSecondary, fontSize: 16 }}>Card non trovata</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.textSecondary} />}>
            <Animated.View entering={FadeInDown.delay(80).duration(450)}>
              <FlipCard card={card} />
            </Animated.View>

            {card.counters && card.counters.length > 0 && (
              <Animated.View entering={FadeInDown.delay(180).duration(450)}>
                <Text style={[styles.section, { color: t.textSecondary }]}>Saldi e contatori</Text>
                <GlassPanel radius={Radius.lg}>
                  {card.counters.map((c, i) => {
                    const f = formatCounter(c);
                    return (
                      <View key={`${c.type}-${c.name}-${i}`}>
                        <View style={styles.row}>
                          <View style={styles.rowText}>
                            <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                              {f.label}
                            </Text>
                            {c.name ? (
                              <Text style={{ color: t.textSecondary, fontSize: 13 }} numberOfLines={1}>
                                {c.name}
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.rowValue}>
                            <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
                              {f.value}
                            </Text>
                            {c.limit !== undefined && c.limit !== 0 ? (
                              <Text style={{ color: t.textSecondary, fontSize: 12 }}>
                                Limite {c.type === 'euro' ? euroFormat.format(c.limit) : numberFormat.format(c.limit)}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        {i < card.counters!.length - 1 && <View style={[styles.separator, { backgroundColor: t.border }]} />}
                      </View>
                    );
                  })}
                </GlassPanel>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(280).duration(450)}>
              <Text style={[styles.section, { color: t.textSecondary }]}>Informazioni</Text>
              <GlassPanel radius={Radius.lg}>
                {infoRows(card).map((r, i, all) => (
                  <View key={r.label}>
                    <View style={styles.row}>
                      <Text style={{ color: t.textSecondary, fontSize: 14, width: 112 }}>{r.label}</Text>
                      <Text
                        style={{ color: r.label === 'Stato' && card.blocked ? t.danger : t.text, fontSize: 15, fontWeight: '500', flex: 1, textAlign: 'right' }}>
                        {r.value}
                      </Text>
                    </View>
                    {i < all.length - 1 && <View style={[styles.separator, { backgroundColor: t.border }]} />}
                  </View>
                ))}
              </GlassPanel>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(380).duration(450)}>
              <CardMovements accountKey={card.accountKey ?? ''} cardId={card.id} refreshKey={refreshKey} />
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(480).duration(450)}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={toggleBlocked}
                style={({ pressed }) => [styles.blockButton, { borderColor: card.blocked ? t.border : t.danger, opacity: pressed || busy ? 0.6 : 1 }]}>
                {card.blocked ? <LockOpen size={20} color={t.text} strokeWidth={2.2} /> : <Lock size={20} color={t.danger} strokeWidth={2.2} />}
                <Text style={{ color: card.blocked ? t.text : t.danger, fontSize: 16, fontWeight: '600' }}>
                  {card.blocked ? 'Sblocca card' : 'Blocca card'}
                </Text>
              </Pressable>
            </Animated.View>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24, paddingTop: 16, gap: 20 },
  section: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 22 },
  rowText: { flex: 1, gap: 2 },
  rowValue: { alignItems: 'flex-end', gap: 2, maxWidth: '55%' },
  separator: { height: StyleSheet.hairlineWidth, marginHorizontal: 18 },
  blockButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: Radius.md, borderWidth: 1.5 },
});
