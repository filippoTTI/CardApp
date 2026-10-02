import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Keyboard, Platform, StyleSheet, Text, TouchableWithoutFeedback, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { GlassPanel } from '@/components/ui/glass-panel';
import { Spacing } from '@/constants/theme';
import { UiScaleContext, useRadius } from '@/context/ui-scale';
import { useTheme } from '@/hooks/use-theme';

type Props = { title: string; subtitle: string; children: ReactNode };

const MIN_SCALE = 0.6;
const MAX_WIDTH = 480;
/** Spazio che resta tra il fondo della card e la tastiera quando il contenuto si solleva. */
const KEYBOARD_GAP = 20;

const AnchorContext = createContext<(bottomInCard: number) => void>(() => {});

/**
 * Il contenuto si solleva solo se la tastiera coprirebbe il tasto principale (Accedi / Registrati), non il resto della card.
 * Il tasto si segna avvolgendolo in <KeyboardAnchor>.
 */
export function KeyboardAnchor({ children }: { children: ReactNode }) {
  const report = useContext(AnchorContext);
  return <View onLayout={(e) => report(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>{children}</View>;
}

function Card({ children }: { children: ReactNode }) {
  const radius = useRadius();
  return (
    <GlassPanel radius={radius.lg} style={styles.card}>
      {children}
    </GlassPanel>
  );
}

export function AuthScreen({ title, subtitle, children }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Niente scroll: a tastiera chiusa il contenuto viene rimpicciolito (mai ingrandito) per entrare nello schermo.
  // La larghezza è compensata dividendola per lo scale, così resta uguale su tutte le schermate.
  const [available, setAvailable] = useState(0);
  const [natural, setNatural] = useState(0);
  const [heroHeight, setHeroHeight] = useState(0);
  const [areaY, setAreaY] = useState(0);
  const [anchorBottom, setAnchorBottom] = useState<number>();
  const scale = available && natural ? Math.min(1, Math.max(MIN_SCALE, available / natural)) : 1;

  // Tastiera: NON rimpicciolisce nulla. Il contenuto scorre verso l'alto quanto basta per non coprire il tasto,
  // e il logo (in cima) sfuma man mano che esce dallo schermo.
  const keyboardOpen = useRef(false);
  const keyboardHeight = useSharedValue(0);
  const areaRef = useRef<View>(null);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const move = (height: number, duration?: number) =>
      keyboardHeight.set(withTiming(height, { duration: duration ?? 250, easing: Easing.out(Easing.cubic) }));
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboardOpen.current = true;
      move(e.endCoordinates.height, e.duration);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      keyboardOpen.current = false;
      move(0, e.duration);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboardHeight]);

  const contentHeight = natural * scale;
  const contentTop = areaY + (available - contentHeight) / 2; // posizione a tastiera chiusa, in coordinate schermo
  // Fondo del tasto principale in coordinate schermo (padding del contenuto + hero + spazio + posizione nella card).
  // Se non c'è un tasto segnato, si protegge tutta la card.
  const protectedBottom =
    anchorBottom === undefined ? contentTop + contentHeight : contentTop + (Spacing.three + heroHeight + Spacing.four + anchorBottom) * scale;
  const maxLift = Math.max(0, contentTop - insets.top + heroHeight * scale);
  const heroVisual = Math.max(1, heroHeight * scale);

  // Quanto sollevare: solo se la tastiera è aperta e coprirebbe il tasto principale. A tastiera chiusa è sempre 0
  // (e valori non validi vengono ignorati), così il logo non può sparire per un errore di misura.
  const computeLift = () => {
    'worklet';
    if (keyboardHeight.value < 1) return 0;
    const overlap = protectedBottom - (windowHeight - keyboardHeight.value) + KEYBOARD_GAP;
    const lift = Math.min(maxLift, Math.max(0, overlap));
    return Number.isFinite(lift) ? lift : 0;
  };
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -computeLift() }, { scale }] }));
  const heroStyle = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, computeLift() / (heroVisual * 0.85)) }));

  return (
    <UiScaleContext.Provider value={scale}>
      <AnchorContext.Provider value={setAnchorBottom}>
        <View style={styles.flex}>
          <AnimatedBackground variant="rich" />
          <SafeAreaView style={styles.flex}>
            <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
              <View
                ref={areaRef}
                style={styles.area}
                onLayout={(e) => {
                  if (keyboardOpen.current) return; // a tastiera aperta (Android) non ricalcolare la scala
                  setAvailable(e.nativeEvent.layout.height);
                  areaRef.current?.measureInWindow((_x, y) => setAreaY(y));
                }}>
                <Animated.View
                  style={[
                    styles.content,
                    { width: Math.min(windowWidth, MAX_WIDTH) / scale, opacity: available && natural ? 1 : 0 },
                    liftStyle,
                  ]}
                  onLayout={(e) => {
                    if (!keyboardOpen.current) setNatural(e.nativeEvent.layout.height);
                  }}>
                  <Animated.View style={[styles.hero, heroStyle]} onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}>
                    <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
                    <Text style={[styles.title, { color: t.text }]}>{title}</Text>
                    <Text style={[styles.subtitle, { color: t.textSecondary }]}>{subtitle}</Text>
                  </Animated.View>
                  <Card>{children}</Card>
                </Animated.View>
              </View>
            </TouchableWithoutFeedback>
          </SafeAreaView>
        </View>
      </AnchorContext.Provider>
    </UiScaleContext.Provider>
  );
}

export function Divider({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.divider}>
      <View style={[styles.line, { backgroundColor: t.border }]} />
      <Text style={{ color: t.textSecondary, fontSize: 13 }}>{label}</Text>
      <View style={[styles.line, { backgroundColor: t.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // `area` centra il contenuto; se è più alto dello spazio disponibile sborda in modo simmetrico e lo scale lo riporta dentro.
  area: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: Spacing.three, gap: Spacing.four },
  hero: { alignItems: 'center', gap: Spacing.two },
  logo: { width: 96, height: 96, marginBottom: Spacing.two },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center' },
  card: { padding: Spacing.four, gap: Spacing.three },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
