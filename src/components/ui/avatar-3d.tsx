import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = { initials: string; size?: number };

const PALETTE = {
  light: { hi: '#55D98F', mid: '#22C55E', lo: '#0B7336', rim: '#0A5A2A', shadow: '#052414' },
  dark: { hi: '#40C479', mid: '#1FA653', lo: '#08522A', rim: '#04331A', shadow: '#000000' },
};

const SHADOW_LAYERS = Array.from({ length: 7 }, (_, i) => ({ width: 2 + i * 2.2, opacity: 0.03 }));

/**
 * Avatar a sfera in rilievo: gradiente radiale con luce in alto a sinistra, bordo smussato
 * (chiaro sopra, scuro sotto), riflesso lucido, ombra morbida e iniziali con ombra sotto.
 */
export function Avatar3D({ initials, size = 104 }: Props) {
  const c = PALETTE[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const m = 24; // margine per l'ombra
  const total = size + m * 2;
  const r = size / 2;
  const cx = total / 2;
  const cy = total / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg pointerEvents="none" width={total} height={total} style={[styles.svg, { left: -m, top: -m }]}>
        <Defs>
          <RadialGradient id="body" cx="0.3" cy="0.25" rx="0.95" ry="0.95" fx="0.3" fy="0.25">
            <Stop offset="0" stopColor={c.hi} />
            <Stop offset="0.5" stopColor={c.mid} />
            <Stop offset="1" stopColor={c.lo} />
          </RadialGradient>
          <LinearGradient id="rim" x1="0.25" y1="0" x2="0.75" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.4" />
            <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="1" stopColor={c.rim} stopOpacity="0.4" />
          </LinearGradient>
          <LinearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>
          <ClipPath id="clip">
            <Circle cx={cx} cy={cy} r={r} />
          </ClipPath>
        </Defs>

        {/* ombra morbida */}
        {SHADOW_LAYERS.map(({ width, opacity }) => (
          <G key={width} y={5}>
            <Circle cx={cx} cy={cy} r={r} fill={c.shadow} stroke={c.shadow} strokeWidth={width} opacity={opacity} />
          </G>
        ))}

        <Circle cx={cx} cy={cy} r={r} fill="url(#body)" />
        {/* riflesso lucido in alto */}
        <G clipPath="url(#clip)">
          <Ellipse cx={cx - r * 0.1} cy={cy - r * 0.55} rx={r * 0.72} ry={r * 0.42} fill="url(#gloss)" />
        </G>
        {/* bordo smussato */}
        <Circle cx={cx} cy={cy} r={r - 1.5} fill="none" stroke="url(#rim)" strokeWidth={3} />
      </Svg>

      <View style={styles.center}>
        <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  initials: {
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,45,20,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
});
