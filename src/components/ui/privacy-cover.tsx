import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Copertura a tutto schermo con il solo logo, mostrata quando l'app protetta da codice non è in primo piano. */
export function PrivacyCover() {
  const t = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: t.background }]}>
      <Image source={require('../../../assets/images/logo.png')} style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { zIndex: 1001, elevation: 1001, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 96, height: 96 },
});
