import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Mail, Phone, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { Avatar3D } from '@/components/ui/avatar-3d';
import { GlassPanel } from '@/components/ui/glass-panel';
import { IconButton } from '@/components/ui/icon-button';
import { LogoutButton } from '@/components/ui/logout-button';
import { ParallaxView } from '@/components/ui/parallax-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/context/auth';
import { useCards } from '@/context/cards';
import { useTheme } from '@/hooks/use-theme';
import type { Card } from '@/types/card';

// TODO: dati finti, sostituire con quelli dell'utente reale.
const USER = {
  name: 'Mario Rossi',
  email: 'mario.rossi@esempio.it',
  phone: '+39 333 1234567',
  since: 'Ottobre 2026',
  signIn: 'Email e password',
};

const ROWS: { Icon: LucideIcon; tile: string; label: string; value: string }[] = [
  { Icon: Mail, tile: '#0EA5E9', label: 'Email', value: USER.email },
  { Icon: Phone, tile: '#22C55E', label: 'Telefono', value: USER.phone },
  { Icon: ShieldCheck, tile: '#F59E0B', label: 'Accesso', value: USER.signIn },
];

const nf = new Intl.NumberFormat('it-IT');
const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

/** Riepilogo calcolato dalle card (punti e credito sommati separatamente). */
function summarize(cards: Card[]) {
  let points = 0;
  let euro = 0;
  for (const c of cards) {
    if (c.balance.type === 'points') points += c.balance.amount;
    else euro += c.balance.amount;
  }
  return { cards: cards.length, points, euro };
}

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { deleteAccount } = useAuth();
  const { cards } = useCards();
  const initials = USER.name
    .split(' ')
    .map((p) => p[0])
    .join('');
  const sum = summarize(cards);

  const confirmDelete = () =>
    Alert.alert(
      'Elimina account',
      'Verranno eliminati profilo, card e saldo. L\'azione non può essere annullata.',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: deleteAccount },
      ],
    );

  const stats = [
    { label: 'Card', value: String(sum.cards) },
    { label: 'Punti', value: nf.format(sum.points) },
    { label: 'Credito', value: eur.format(sum.euro) },
  ];

  return (
    <View style={styles.flex}>
      <AnimatedBackground variant="rich" />
      <SafeAreaView style={styles.container}>
        <View>
          <ScreenHeader
            title="Profilo"
            left={
              <IconButton label="Indietro" onPress={() => router.back()}>
                {(color) => <Ionicons name="chevron-back" size={24} color={color} />}
              </IconButton>
            }
            right={<LogoutButton />}
          />
        </View>

        <View style={styles.body}>
          <Animated.View entering={FadeInDown.delay(100).duration(550)}>
            {/* Parallasse con l'inclinazione del telefono: avatar più "vicino" (si muove di più) dei pannelli. */}
            <ParallaxView shift={7} style={styles.hero}>
              <Avatar3D initials={initials} size={112} />
              <Text style={[styles.name, { color: t.text }]}>{USER.name}</Text>
              <GlassPanel radius={999} style={styles.pill}>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: '500' }}>Membro da {USER.since}</Text>
              </GlassPanel>
            </ParallaxView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(250).duration(450)}>
            <ParallaxView shift={4}>
              <GlassPanel radius={Radius.lg}>
                <View style={styles.statsRow}>
                  {stats.map((st, i) => (
                    <View key={st.label} style={[styles.stat, i > 0 && { borderLeftColor: t.border, borderLeftWidth: StyleSheet.hairlineWidth }]}>
                      <Text style={[styles.statValue, { color: t.text }]} numberOfLines={1} adjustsFontSizeToFit>
                        {st.value}
                      </Text>
                      <Text style={{ color: t.textSecondary, fontSize: 12 }}>{st.label}</Text>
                    </View>
                  ))}
                </View>
              </GlassPanel>
            </ParallaxView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400).duration(450)}>
            <ParallaxView shift={4}>
              <GlassPanel radius={Radius.lg}>
                {ROWS.map(({ Icon, tile, label, value }, i) => (
                  <Animated.View key={label} entering={FadeInDown.delay(480 + i * 90).duration(400)}>
                    <View style={styles.row}>
                      <View style={[styles.tile, { backgroundColor: tile }]}>
                        <Icon size={18} color="#FFFFFF" strokeWidth={2.2} />
                      </View>
                      <View style={styles.rowText}>
                        <Text style={{ color: t.textSecondary, fontSize: 12 }}>{label}</Text>
                        <Text style={{ color: t.text, fontSize: 16, fontWeight: '500' }} numberOfLines={1}>
                          {value}
                        </Text>
                      </View>
                    </View>
                    {i < ROWS.length - 1 && <View style={[styles.separator, { backgroundColor: t.border }]} />}
                  </Animated.View>
                ))}
              </GlassPanel>
            </ParallaxView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(800).duration(450)} style={styles.danger}>
            <Pressable
              accessibilityRole="button"
              onPress={confirmDelete}
              hitSlop={8}
              style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}>
              <Trash2 size={18} color={t.danger} strokeWidth={2.2} />
              <Text style={{ color: t.danger, fontSize: 15, fontWeight: '600' }}>Elimina account</Text>
            </Pressable>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  body: { flex: 1, gap: 18 },
  hero: { alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 6 },
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3, marginTop: 6 },
  pill: { paddingHorizontal: 14, paddingVertical: 6 },
  statsRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 16, paddingHorizontal: 8 },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 14 },
  tile: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  danger: { marginTop: 'auto', alignItems: 'center', paddingBottom: 8 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 74 },
});
