import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';

/** Riga con Google e Apple affiancati. TODO: collegare i provider reali. */
export function SocialButtons() {
  return (
    <View style={styles.row}>
      <Button label="Continua con Google" icon="logo-google" variant="social" style={styles.item} onPress={() => {}} />
      <Button label="Continua con Apple" icon="logo-apple" variant="social" style={styles.item} onPress={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  item: { flex: 1 },
});
