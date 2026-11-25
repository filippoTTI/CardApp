import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useRouter } from 'expo-router';
import { QrCode } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, RefreshControl, type RefreshControlProps, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountHeader } from '@/components/ui/account-header';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { CardsSkeleton } from '@/components/ui/cards-skeleton';
import { EmptyCards } from '@/components/ui/empty-cards';
import { EnteringCard } from '@/components/ui/entering-card';
import { FlipCard, H as CARD_H, W as CARD_W } from '@/components/ui/flip-card';
import { HomeHeader, HOME_HEADER_H } from '@/components/ui/home-header';
import { PayWithQr } from '@/components/ui/pay-with-qr';
import { Spacing, Type } from '@/constants/theme';
import { useCards } from '@/context/cards';
import { useTheme } from '@/hooks/use-theme';

// L'indicatore di aggiornamento nativo è nascosto: il gesto resta, la rotella è nell'header (più in alto, fuori dalla sfumatura).
const REFRESH_HIDDEN: Partial<RefreshControlProps> = { tintColor: 'transparent', colors: ['transparent'], progressBackgroundColor: 'transparent' };

// spazio tra una card e la successiva (l'ombra e' piu' larga: si sovrappone appena)
const CARD_GAP = 18;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { accounts, cards, loading, reload } = useCards();
  const multi = accounts.length > 1;
  // account compressi dall'utente (chiave esercente + email)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying] = useState(false);
  // il tasto Paga serve se c'e' almeno una card prepagata sbloccata
  const canPay = cards.some((c) => c.kind === 'prepaid' && !c.blocked);

  // zona del tasto in basso e margine laterale: le card si restringono quanto serve perche' due entrino per intero tra titolo e tasto
  const bottomZone = insets.bottom + (canPay ? 96 : 24);
  const cardsHeight = screenH - insets.top - HOME_HEADER_H - 28 - bottomZone;
  const maxCardWidth = ((cardsHeight - CARD_GAP) / 2) * (CARD_W / CARD_H);
  const sidePadding = cards.length > 1 ? Math.max(24, (screenW - maxCardWidth) / 2) : 24;
  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  // Senza card (es. appena registrati: la card la crea il gestionale) si ricontrolla ogni 30 secondi finché la home è in primo piano.
  const focused = useIsFocused();
  const waiting = focused && !loading && cards.length === 0;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => {
      if (AppState.currentState === 'active') void reload();
    }, 30000);
    return () => clearInterval(id);
  }, [waiting, reload]);

  // Le card (SVG, ombre) sono la parte pesante: compaiono a transizione finita, una dopo l'altra, così l'ingresso resta fluido.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestIdleCallback(() => setReady(true), { timeout: 500 });
    return () => cancelIdleCallback(id);
  }, []);

  return (
    <View style={styles.container}>
      <AnimatedBackground variant="calm" />
      <SafeAreaView edges={['top']} style={styles.container}>
        <Animated.View entering={FadeInDown.delay(100).duration(550)} style={styles.header}>
          <HomeHeader
            caption={accounts.length > 1 ? `${accounts.length} account` : accounts[0]?.ragioneSociale}
            onProfile={() => router.push('/profile')}
            onAdd={() => router.push('/add-account' as never)}
          />
        </Animated.View>

        {loading ? (
          <View style={styles.skeleton}>
            <CardsSkeleton />
          </View>
        ) : !multi && cards.length === 0 && !accounts[0]?.error ? (
          // anche senza card si può tirare giù per aggiornare: le card assegnate nel frattempo compaiono
          <ScrollView
            contentContainerStyle={styles.flexGrow}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...REFRESH_HIDDEN} />}>
            <EmptyCards />
          </ScrollView>
        ) : (
          <View style={styles.flex}>
            {/* Maschera: i contenuti sfumano in trasparenza sotto l'header e in fondo allo schermo mentre scorrono (funziona sopra lo sfondo animato). */}
            <MaskedView
              style={[styles.flex, styles.underHeader]}
              maskElement={
                <View style={styles.flex}>
                  <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,1)']} style={styles.fade} />
                  <View style={styles.opaque} />
                  <LinearGradient colors={['rgba(0,0,0,1)', 'rgba(0,0,0,0)']} style={styles.fadeBottom} />
                </View>
              }>
              <ScrollView
                contentContainerStyle={[styles.list, { paddingBottom: bottomZone, paddingHorizontal: sidePadding }, !multi && cards.length === 1 && styles.single]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...REFRESH_HIDDEN} />}>
                {ready &&
                  accounts.map((group) => {
                    const open = !multi || !collapsed[group.key];
                    return (
                      // al cambio di account in uso i gruppi scorrono nella nuova posizione invece di saltare
                      <Animated.View
                        key={group.key}
                        style={styles.group}
                        layout={LinearTransition.duration(350)}
                        entering={FadeIn.duration(300)}
                        exiting={FadeOut.duration(200)}>
                        {multi && (
                          <AccountHeader
                            title={group.ragioneSociale}
                            subtitle={group.email}
                            count={group.cards.length}
                            loading={group.loading}
                            expanded={open}
                            onPress={() => setCollapsed((c) => ({ ...c, [group.key]: !c[group.key] }))}
                          />
                        )}
                        {open && group.error && group.cards.length === 0 && (
                          <Text style={[styles.note, { color: t.textSecondary }]}>{group.error}</Text>
                        )}
                        {open && !group.loading && !group.error && group.cards.length === 0 && (
                          <Text style={[styles.note, { color: t.textSecondary }]}>Nessuna card</Text>
                        )}
                        {open &&
                          group.cards.map((card, i) => (
                            <EnteringCard key={card.id} index={i}>
                              <FlipCard card={card} onOpenDetails={() => router.push({ pathname: '/card-details', params: { id: card.id } } as never)} />
                            </EnteringCard>
                          ))}
                      </Animated.View>
                    );
                  })}
              </ScrollView>
            </MaskedView>
          </View>
        )}
      </SafeAreaView>
      {/* rotella di aggiornamento: pastiglia centrata in cima, sopra header e sfumatura */}
      {refreshing && (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(180)}
          pointerEvents="none"
          style={[styles.refresh, { top: insets.top + 6, backgroundColor: t.card, borderColor: t.border }]}>
          <ActivityIndicator color={t.text} />
        </Animated.View>
      )}
      {canPay && !loading && (
        <Animated.View entering={FadeInDown.delay(350).duration(450)} pointerEvents="box-none" style={[styles.payWrap, { bottom: insets.bottom + 18 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setPaying(true)}
            style={({ pressed }) => [styles.payButton, { backgroundColor: t.primary, shadowColor: t.primary, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <View style={[styles.payIcon, { backgroundColor: `${t.primaryText}26` }]}>
              <QrCode size={18} color={t.primaryText} strokeWidth={2.4} />
            </View>
            <Text style={[Type.section, { color: t.primaryText, letterSpacing: 0.1 }]}>Paga in cassa</Text>
          </Pressable>
        </Animated.View>
      )}
      <PayWithQr
        cards={cards}
        visible={paying}
        onClose={() => setPaying(false)}
        onPaid={() => {
          void reload();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // pillola centrata sopra le card, con ombra leggera
  refresh: { position: 'absolute', alignSelf: 'center', width: 40, height: 40, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  payWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    height: 56,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.four - 2,
    borderRadius: 28,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  payIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flexGrow: { flexGrow: 1 },
  // Stesso padding della lista reale, così le card scheletro occupano la posizione delle card vere.
  skeleton: { flex: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.four },
  fade: { height: 36 },
  fadeBottom: { height: 48 },
  opaque: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, zIndex: 1 },
  // La zona scorrevole sale sotto l'header: la dissolvenza avviene subito sotto il titolo, non più in basso.
  underHeader: { marginTop: -16 },
  // La ScrollView occupa tutta la larghezza e il padding sta DENTRO il contenuto: l'ombra delle card
  // non viene tagliata dai bordi della ScrollView (a lato e sopra/sotto).
  list: { gap: CARD_GAP, paddingHorizontal: 24, paddingTop: 28 },
  // un account: le sue card; con più account ognuno ha la sua sezione
  group: { gap: CARD_GAP },
  note: { ...Type.body, textAlign: 'center', paddingVertical: Spacing.two },
  // una sola card: centrata verticalmente nello schermo; più card: lista dall'alto al basso
  single: { flexGrow: 1, justifyContent: 'center' },
});
