export const Colors = {
  light: {
    text: '#0F1A12',
    textSecondary: '#5B6B60',
    background: '#FFFFFF',
    surface: '#F3F6F4',
    border: '#DDE5DF',
    primary: '#16A34A',
    primaryText: '#FFFFFF',
    danger: '#DC2626',
    card: 'rgba(255,255,255,0.78)',
  },
  dark: {
    text: '#F2F7F3',
    textSecondary: '#9DB0A3',
    background: '#0A0F0C',
    surface: '#151D18',
    border: '#26332B',
    primary: '#22C55E',
    primaryText: '#04130A',
    danger: '#F87171',
    card: 'rgba(21,29,24,0.72)',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = { one: 4, two: 8, three: 16, four: 24, five: 32, six: 48 } as const;
export const Radius = { md: 24, lg: 40 } as const;
