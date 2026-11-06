import { ChevronLeft } from 'lucide-react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInLeft, FadeInRight, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedBackground } from '@/components/ui/animated-background';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Tasto principale: resta fisso in fondo, sopra la tastiera. */
  action?: ReactNode;
  /** Posizione (da 0) e numero totale di step: con più di uno compaiono i puntini in alto. */
  step?: number;
  steps?: number;
  /** Pagina mostrata (per l'animazione di passaggio); se manca vale `step`. Serve quando due pagine hanno lo stesso puntino. */
  page?: number;
  /** Se presente compare la freccia indietro in alto a sinistra. */
  onBack?: () => void;
  /** Logo grande sopra il titolo (di norma solo al primo step). */
  showLogo?: boolean;
};

const MAX_WIDTH = 480;
/** Margine tra il campo selezionato e il bordo dell'area scorrevole quando lo si porta in vista. */
const FIELD_MARGIN = 24;

type EnsureVisible = (node: View | null) => void;
const EnsureVisibleContext = createContext<EnsureVisible>(() => {});

/** I campi di testo lo chiamano quando ricevono il focus: l'area scorrevole li porta in vista sopra la tastiera. */
export function useEnsureVisible() {
  return useContext(EnsureVisibleContext);
}

export function AuthScreen({ title, subtitle, children, action, step = 0, steps = 1, page = step, onBack, showLogo = true }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollWrapRef = useRef<View>(null);
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  // la pagina deve entrare nello schermo senza scorrere: si scorre solo se il contenuto è davvero più alto dell'area
  const [viewH, setViewH] = useState(0);
  const [contentH, setContentH] = useState(0);
  // con la tastiera aperta logo e sottotitolo spariscono per lasciare spazio ai campi
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Tastiera: quanto copre la nostra area. Si misura sul layout reale, così funziona sia quando Android ridimensiona
  // la finestra (copertura 0) sia quando non lo fa (iOS e Android edge-to-edge).
  const keyboardTop = useRef<number | null>(null);
  const keyboardDuration = useRef(220);
  const inset = useSharedValue(0);

  const syncInset = useCallback(() => {
    const top = keyboardTop.current;
    if (top === null) {
      inset.set(withTiming(0, { duration: keyboardDuration.current, easing: Easing.out(Easing.cubic) }));
      return;
    }
    rootRef.current?.measureInWindow((_x, y, _w, h) => {
      const covered = Math.max(0, y + h - top);
      inset.set(withTiming(covered, { duration: keyboardDuration.current, easing: Easing.out(Easing.cubic) }));
    });
  }, [inset]);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardVisible(true);
      keyboardDuration.current = e.duration || 220;
      syncInset();
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      keyboardTop.current = null;
      setKeyboardVisible(false);
      keyboardDuration.current = e.duration || 220;
      syncInset();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [syncInset]);

  const ensureVisible = useCallback<EnsureVisible>((node) => {
    if (!node) return;
    // si aspetta che tastiera e layout si assestino prima di misurare
    setTimeout(() => {
      scrollWrapRef.current?.measureInWindow((_x, viewY) => {
        node.measureInWindow((_fx, fieldY, _fw, fieldH) => {
          const top = fieldY - viewY;
          const bottom = top + fieldH;
          const height = viewportHeight.current;
          if (top < FIELD_MARGIN) scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current + top - FIELD_MARGIN), animated: true });
          else if (bottom > height - FIELD_MARGIN) scrollRef.current?.scrollTo({ y: scrollY.current + bottom - height + FIELD_MARGIN, animated: true });
        });
      });
    }, 280);
  }, []);

  // direzione dello scorrimento tra step: si confronta con lo step del render precedente
  const [prevPage, setPrevPage] = useState(page);
  const [forward, setForward] = useState(true);
  if (page !== prevPage) {
    setForward(page > prevPage);
    setPrevPage(page);
  }

  const bodyStyle = useAnimatedStyle(() => ({ paddingBottom: inset.value }));
  // con la tastiera aperta l'area sicura in basso è già coperta
  const actionStyle = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, insets.bottom - inset.value) + Spacing.three }));

  return (
    <View style={styles.flex}>
      <AnimatedBackground variant="rich" />
      <View ref={rootRef} style={[styles.flex, { paddingTop: insets.top }]} onLayout={syncInset}>
        <Animated.View style={[styles.flex, bodyStyle]}>
          <View style={styles.header}>
            <View style={styles.headerSide}>
              {onBack && (
                <Pressable accessibilityRole="button" accessibilityLabel="Indietro" hitSlop={12} onPress={onBack} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                  <ChevronLeft size={28} color={t.text} strokeWidth={2.2} />
                </Pressable>
              )}
            </View>
            {steps > 1 && (
              <View style={styles.dots} accessibilityLabel={`Passo ${step + 1} di ${steps}`}>
                {Array.from({ length: steps }, (_, i) => (
                  <View key={i} style={[styles.dot, { backgroundColor: i <= step ? t.primary : t.border, width: i === step ? 22 : 8 }]} />
                ))}
              </View>
            )}
            <View style={styles.headerSide} />
          </View>

          <View ref={scrollWrapRef} style={styles.flex} onLayout={(e) => {
              viewportHeight.current = e.nativeEvent.layout.height;
              setViewH(e.nativeEvent.layout.height);
            }}>
            <ScrollView
              ref={scrollRef}
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              showsVerticalScrollIndicator={false}
              bounces={false}
              overScrollMode="never"
              scrollEnabled={contentH > viewH + 1}
              onContentSizeChange={(_w, h) => setContentH(h)}
              scrollEventThrottle={16}
              onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}>
              <EnsureVisibleContext.Provider value={ensureVisible}>
                <Animated.View key={page} entering={(forward ? FadeInRight : FadeInLeft).duration(220)} style={styles.content}>
                  <Animated.View style={styles.hero} layout={LinearTransition.duration(200)}>
                    {showLogo && !keyboardVisible && (
                      <Animated.View entering={FadeIn} exiting={FadeOut.duration(120)}>
                        <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
                      </Animated.View>
                    )}
                    <Text style={[styles.title, { color: t.text }]}>{title}</Text>
                    {!keyboardVisible && (
                      <Animated.Text entering={FadeIn} exiting={FadeOut.duration(120)} style={[styles.subtitle, { color: t.textSecondary }]}>
                        {subtitle}
                      </Animated.Text>
                    )}
                  </Animated.View>
                  <View style={styles.form}>{children}</View>
                </Animated.View>
              </EnsureVisibleContext.Provider>
            </ScrollView>
          </View>

          {action && (
            <Animated.View style={[styles.action, actionStyle]}>
              <View style={styles.actionInner}>{action}</View>
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three },
  headerSide: { width: 40, alignItems: 'flex-start' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.four, alignItems: 'center' },
  content: { width: '100%', maxWidth: MAX_WIDTH, gap: Spacing.four },
  hero: { alignItems: 'center', gap: Spacing.two },
  logo: { width: 72, height: 72, marginBottom: Spacing.one },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center' },
  form: { gap: Spacing.three },
  action: { paddingHorizontal: Spacing.four, paddingTop: Spacing.two, alignItems: 'center' },
  actionInner: { width: '100%', maxWidth: MAX_WIDTH },
});
