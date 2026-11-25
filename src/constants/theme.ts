import type { TextStyle } from 'react-native';

// Superfici neutre e bordi sottili: il verde resta l'unico accento (primary e stati), non colora anche gli sfondi.
export const Colors = {
  light: {
    text: '#0F1A12',
    textSecondary: '#5C6A60',
    background: '#FFFFFF',
    surface: '#F4F6F5',
    border: '#E1E6E3',
    primary: '#16A34A',
    primaryText: '#FFFFFF',
    danger: '#DC2626',
    card: 'rgba(255,255,255,0.78)',
  },
  dark: {
    text: '#F2F7F3',
    textSecondary: '#9AABA0',
    background: '#0A0F0C',
    surface: '#141A17',
    border: '#252E29',
    primary: '#22C55E',
    primaryText: '#04130A',
    danger: '#F87171',
    card: 'rgba(21,29,24,0.72)',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = { one: 4, two: 8, three: 16, four: 24, five: 32, six: 48 } as const;
export const Radius = { sm: 16, md: 24, lg: 40, pill: 999 } as const;

/** Scala tipografica: usare questi stili invece di dimensioni sparse nei componenti. */
export const Type = {
  display: { fontSize: 44, fontWeight: '800', letterSpacing: -1 },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  section: { fontSize: 17, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '500' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  stat: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
} as const satisfies Record<string, TextStyle>;
