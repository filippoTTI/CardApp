import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Trash2, UserRound } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { InteractionManager, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { Button } from '@/components/ui/button';
import { EmptyCards } from '@/components/ui/empty-cards';
import { EnteringCard } from '@/components/ui/entering-card';
import { CARD_SHADOW_CLEARANCE, FlipCard } from '@/components/ui/flip-card';
import { IconButton } from '@/components/ui/icon-button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useAuth } from '@/context/auth';
import { useCards } from '@/context/cards';
import { isPasskeySupported } from '@/services/passkey';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cards, assignSampleCards, clearCards } = useCards();
  const { shouldOfferPasskey, dismissPasskeyOffer } = useAuth();

  // Le card (SVG, ombre) sono la parte pesante: compaiono a transizione finita, una dopo l'altra, così l'ingresso resta fluido.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);

  // Al primo login riuscito propone la creazione della passkey.
  useEffect(() => {
    if (!shouldOfferPasskey) return;
    if (isPasskeySupported()) router.push('/passkey-setup');
    else dismissPasskeyOffer();
  }, [shouldOfferPasskey, router, dismissPasskeyOffer]);

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
              cards.length > 0 ? (
                // TODO: SOLO TEST GRAFICI, da rimuovere
                <IconButton label="Svuota card" bare onPress={clearCards}>
                  {(color) => <Trash2 size={26} color={color} strokeWidth={1.9} />}
                </IconButton>
              ) : undefined
            }
          />
        </Animated.View>

        {cards.length === 0 ? (
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
                contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 56 }, cards.length === 1 && styles.single]}
                showsVerticalScrollIndicator={false}>
                {ready &&
                  cards.map((card, i) => (
                    <EnteringCard key={card.id} index={i}>
                      <FlipCard card={card} />
                    </EnteringCard>
                  ))}
              </ScrollView>
            </MaskedView>
          </View>
        )}

        {/* TODO: SOLO TEST GRAFICI, da rimuovere */}
        {cards.length === 0 && (
          <View style={[styles.testButton, { paddingBottom: insets.bottom + 16 }]}>
            <Button title="Assegna card (test)" variant="social" onPress={assignSampleCards} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  testButton: { paddingHorizontal: 24 },
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
  // una sola card: centrata verticalmente nello schermo; più card: lista dall'alto al basso
  single: { flexGrow: 1, justifyContent: 'center' },
});
