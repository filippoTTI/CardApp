import { Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';

/** C'è almeno un accesso alternativo da mostrare (per ora solo Apple, su iOS): serve a nascondere anche il separatore. */
export const hasSocialLogin = Platform.OS === 'ios';

/** Accessi alternativi. Google è stato rimosso per ora; Apple (solo iOS) non è ancora collegato (TODO). */
export function SocialButtons() {
  if (!hasSocialLogin) return null;
  return (
    <View style={styles.row}>
      <Button label="Continua con Apple" icon="logo-apple" variant="social" style={styles.item} onPress={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  item: { flex: 1 },
});
