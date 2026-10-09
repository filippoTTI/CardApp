import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ChevronRight, Lock, Mail, Phone, ShieldCheck, Trash2, type LucideIcon } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountList } from '@/components/ui/account-list';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { Avatar3D } from '@/components/ui/avatar-3d';
import { GlassPanel } from '@/components/ui/glass-panel';
import { IconButton } from '@/components/ui/icon-button';
import { LogoutButton } from '@/components/ui/logout-button';
import { ParallaxView } from '@/components/ui/parallax-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { euroFormat, numberFormat } from '@/constants/format';
import { Radius } from '@/constants/theme';
import { useAppLock } from '@/context/app-lock';
import { useAuth } from '@/context/auth';
import { useCards } from '@/context/cards';
import { useTheme } from '@/hooks/use-theme';
import type { AuthCliente } from '@/services/auth';
import type { Card } from '@/types/card';

type InfoRow = { Icon: LucideIcon; tile: string; label: string; value: string };

const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const PROVIDER_LABEL: Record<string, string> = { google: 'Google', apple: 'Apple' };

/** yyyyMMdd -> "Ottobre 2026". */
function memberSince(value?: string): string | undefined {
  if (!value || value.length !== 8) return undefined;
  const month = Number(value.slice(4, 6));
  return MONTHS[month - 1] ? `${MONTHS[month - 1]} ${value.slice(0, 4)}` : undefined;
}

/** Come accede il cliente: email e password e/o provider collegati. */
function accessLabel(user: AuthCliente): string {
  const methods = [
    ...(user.accessoPassword ? ['Email e password'] : []),
    // il backend potrebbe non inviare ancora il campo (versione precedente): in quel caso nessun provider
    ...(user.provider ?? []).map((p) => PROVIDER_LABEL[p] ?? p),
  ];
  return methods.join(' · ');
}

function infoRows(user: AuthCliente): InfoRow[] {
  const rows: InfoRow[] = [{ Icon: Mail, tile: '#0EA5E9', label: 'Email', value: user.email }];
  if (user.telefono) rows.push({ Icon: Phone, tile: '#22C55E', label: 'Telefono', value: user.telefono });
  const access = accessLabel(user);
  if (access) rows.push({ Icon: ShieldCheck, tile: '#F59E0B', label: 'Accesso', value: access });
  return rows;
}

/** Riepilogo calcolato dalle card (punti e credito sommati separatamente). */
function summarize(cards: Card[]) {
  let points = 0;
  let euro = 0;
  for (const c of cards) {
    if (c.balance) {
      if (c.balance.type === 'points') points += c.balance.amount;
      else euro += c.balance.amount;
    }
    points += c.extraPoints ?? 0;
  }
  return { cards: cards.length, points, euro };
}

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { user, deleteAccount } = useAuth();
  const { accounts } = useCards();
  // il riepilogo riguarda solo le card dell'account in uso, come nome e contatti sopra
  const cards = accounts.find((g) => g.key === user?.accountKey)?.cards ?? [];
  const { enabled: lockEnabled, biometricAvailable, biometricEnabled, setBiometricEnabled } = useAppLock();
  const fullName = user ? `${user.nome} ${user.cognome}`.trim() : '';
  const initials = user ? `${user.nome.charAt(0)}${user.cognome.charAt(0)}`.toUpperCase() || user.email.charAt(0).toUpperCase() : '';
  const since = memberSince(user?.membroDal);
  const rows = user ? infoRows(user) : [];
  const sum = summarize(cards);

  const confirmDelete = () =>
    Alert.alert(
      'Elimina account',
      "Verranno eliminati il tuo accesso e i dati del profilo. Le card assegnate dai negozi restano di loro proprietà. L'azione non può essere annullata.",
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            deleteAccount().catch((e) => Alert.alert('Elimina account', e instanceof Error ? e.message : 'Errore imprevisto'));
          },
        },
      ],
    );

  const stats = [
    { label: 'Card', value: String(sum.cards) },
    { label: 'Punti', value: numberFormat.format(sum.points) },
    { label: 'Credito', value: euroFormat.format(sum.euro) },
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

        <ScrollView style={styles.flex} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.delay(100).duration(550)}>
            {/* Parallasse con l'inclinazione del telefono: avatar più "vicino" (si muove di più) dei pannelli. */}
            <ParallaxView shift={7} style={styles.hero}>
              <Avatar3D initials={initials} size={112} />
              <Text style={[styles.name, { color: t.text }]}>{fullName}</Text>
              {user?.esercente ? <Text style={{ color: t.textSecondary, fontSize: 14 }}>{user.esercente}</Text> : null}
              {since && (
                <GlassPanel radius={999} style={styles.pill}>
                  <Text style={{ color: t.text, fontSize: 13, fontWeight: '500' }}>Membro da {since}</Text>
                </GlassPanel>
              )}
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
                {rows.map(({ Icon, tile, label, value }, i) => (
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
                    {i < rows.length - 1 && <View style={[styles.separator, { backgroundColor: t.border }]} />}
                  </Animated.View>
                ))}
              </GlassPanel>
            </ParallaxView>
          </Animated.View>

          <AccountList />

          {/* Codice di sblocco dell'app: vale per tutti gli account e resta solo su questo dispositivo. */}
          <Animated.View entering={FadeInDown.delay(600).duration(450)}>
            <ParallaxView shift={4}>
              <GlassPanel radius={Radius.lg}>
                <View style={styles.row}>
                  <View style={[styles.tile, { backgroundColor: '#8B5CF6' }]}>
                    <Lock size={18} color="#FFFFFF" strokeWidth={2.2} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={{ color: t.text, fontSize: 16, fontWeight: '500' }}>Proteggi app</Text>
                    <Text style={{ color: t.textSecondary, fontSize: 12 }}>{"Codice di 4 cifre all'apertura"}</Text>
                  </View>
                  <Switch
                    accessibilityLabel="Proteggi app con un codice"
                    value={lockEnabled}
                    onValueChange={() => router.push({ pathname: '/pin-setup', params: { mode: lockEnabled ? 'disable' : 'set' } } as never)}
                  />
                </View>
                {lockEnabled && biometricAvailable && (
                  <>
                    <View style={[styles.separator, { backgroundColor: t.border }]} />
                    <View style={styles.row}>
                      <View style={styles.tileSpacer} />
                      <View style={styles.rowText}>
                        <Text style={{ color: t.text, fontSize: 16, fontWeight: '500' }}>Sblocco biometrico</Text>
                        <Text style={{ color: t.textSecondary, fontSize: 12 }}>Face ID o impronta al posto del codice</Text>
                      </View>
                      <Switch
                        accessibilityLabel="Sblocca con la biometria"
                        value={biometricEnabled}
                        onValueChange={(v) => {
                          void setBiometricEnabled(v);
                        }}
                      />
                    </View>
                  </>
                )}
                {lockEnabled && (
                  <>
                    <View style={[styles.separator, { backgroundColor: t.border }]} />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/pin-setup', params: { mode: 'change' } } as never)}
                      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
                      <View style={styles.tileSpacer} />
                      <View style={styles.rowText}>
                        <Text style={{ color: t.text, fontSize: 16, fontWeight: '500' }}>Cambia codice</Text>
                      </View>
                      <ChevronRight size={20} color={t.textSecondary} />
                    </Pressable>
                  </>
                )}
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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: 20 },
  body: { flexGrow: 1, gap: 18, paddingBottom: 16 },
  hero: { alignItems: 'center', gap: 10, marginTop: 20, marginBottom: 6 },
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.3, marginTop: 6 },
  pill: { paddingHorizontal: 14, paddingVertical: 6 },
  statsRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 16, paddingHorizontal: 8 },
  statValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 14 },
  tile: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  tileSpacer: { width: 36, height: 36 },
  danger: { marginTop: 'auto', alignItems: 'center', paddingBottom: 8 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 74 },
});
