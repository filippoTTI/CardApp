import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Plus, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { InteractionManager, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountHeader } from '@/components/ui/account-header';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { CardsSkeleton } from '@/components/ui/cards-skeleton';
import { EmptyCards } from '@/components/ui/empty-cards';
import { EnteringCard } from '@/components/ui/entering-card';
import { CARD_SHADOW_CLEARANCE, FlipCard } from '@/components/ui/flip-card';
import { IconButton } from '@/components/ui/icon-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useCards } from '@/context/cards';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const { accounts, cards, loading, reload } = useCards();
  const multi = accounts.length > 1;
  // account compressi dall'utente (chiave esercente + email)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  // Le card (SVG, ombre) sono la parte pesante: compaiono a transizione finita, una dopo l'altra, così l'ingresso resta fluido.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);

  return (
    <View style={styles.container}>
      <AnimatedBackground variant="rich" />
      <SafeAreaView edges={['top']} style={styles.container}>
        <Animated.View entering={FadeInDown.delay(100).duration(550)} style={styles.header}>
          <ScreenHeader
            title="Le mie card"
            left={
              <IconButton label="Profilo" bare onPress={() => router.push('/profile')}>
                {(color) => <UserRound size={28} color={color} strokeWidth={1.9} />}
              </IconButton>
            }
            right={
              <IconButton label="Aggiungi account" bare onPress={() => router.push('/add-account' as never)}>
                {(color) => <Plus size={28} color={color} strokeWidth={1.9} />}
              </IconButton>
            }
          />
        </Animated.View>

        {loading ? (
          <View style={styles.skeleton}>
            <CardsSkeleton />
          </View>
        ) : !multi && cards.length === 0 && !accounts[0]?.error ? (
          <EmptyCards />
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
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 56 }, !multi && cards.length === 1 && styles.single]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // Stesso padding della lista reale, così le card scheletro occupano la posizione delle card vere.
  skeleton: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  fade: { height: 36 },
  fadeBottom: { height: 48 },
  opaque: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1 },
  header: { paddingHorizontal: 20, zIndex: 1 },
  // La zona scorrevole sale sotto l'header: la dissolvenza avviene subito sotto il titolo, non più in basso.
  underHeader: { marginTop: -16 },
  // La ScrollView occupa tutta la larghezza e il padding sta DENTRO il contenuto: l'ombra delle card
  // non viene tagliata dai bordi della ScrollView (a lato e sopra/sotto).
  list: { gap: CARD_SHADOW_CLEARANCE, paddingHorizontal: 24, paddingTop: 40 },
  // un account: le sue card; con più account ognuno ha la sua sezione
  group: { gap: CARD_SHADOW_CLEARANCE },
  note: { fontSize: 15, textAlign: 'center', paddingVertical: 8 },
  // una sola card: centrata verticalmente nello schermo; più card: lista dall'alto al basso
  single: { flexGrow: 1, justifyContent: 'center' },
});
