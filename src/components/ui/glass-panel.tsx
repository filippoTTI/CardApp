import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  radius: number;
  /** Versione più leggera (campi di testo): meno opaca e meno sfocata, ma con un po' di risalto. */
  subtle?: boolean;
  /** Riempie tutto il contenitore (uso come sfondo dietro ad altri elementi). */
  fill?: boolean;
  children?: ReactNode;
  /** Stile del contenuto (padding, gap...). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Pannello "liquid glass" (con `subtle` una variante più leggera per i campi di testo):
 *  - iOS 26+: vetro nativo (GlassView) con rifrazione e riflessi di sistema
 *  - iOS precedenti: sfocatura dello sfondo + velo e bordo luminoso
 *  - Android: velo traslucido con bordo luminoso (la sfocatura costerebbe troppo)
 */
export function GlassPanel({ radius, subtle, fill, children, style }: Props) {
  const dark = useColorScheme() === 'dark';

  // Variante `subtle` (campi e tasti sopra un pannello): "incassata", cioè più scura del pannello che la
  // contiene, con bordo più marcato e ombra interna in alto. Così si stacca bene dal vetro sottostante.
  const inset = dark ? 'rgba(0,0,0,0.32)' : 'rgba(6,40,22,0.04)';
  const insetShadow = dark ? 'rgba(0,0,0,0.28)' : 'rgba(6,40,22,0.05)';
  const insetBorder = dark ? 'rgba(255,255,255,0.22)' : 'rgba(6,40,22,0.10)';

  const InsetLayers = subtle ? (
    <>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: inset }]} />
      <LinearGradient
        pointerEvents="none"
        colors={[insetShadow, 'rgba(0,0,0,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.55 }}
        style={StyleSheet.absoluteFill}
      />
    </>
  ) : null;

  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle={subtle ? 'clear' : 'regular'}
        colorScheme={dark ? 'dark' : 'light'}
        style={[{ borderRadius: radius, overflow: 'hidden' }, subtle && { borderWidth: StyleSheet.hairlineWidth, borderColor: insetBorder }, fill && StyleSheet.absoluteFill, style]}>
        {InsetLayers}
        {children}
      </GlassView>
    );
  }

  const tint = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.38)';
  const border = subtle ? insetBorder : dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.65)';
  const sheen = dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.5)';

  return (
    <View style={[styles.base, fill && StyleSheet.absoluteFill, { borderRadius: radius, borderColor: border }]}>
      {Platform.OS === 'ios' && (
        <BlurView intensity={subtle ? 18 : dark ? 40 : 55} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      )}
      {!subtle && <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />}
      {InsetLayers}
      {/* riflesso sul bordo superiore sinistro, come il vetro */}
      {!subtle && (
        <LinearGradient
          pointerEvents="none"
          colors={[sheen, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={style}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
