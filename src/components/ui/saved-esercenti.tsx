import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { listAccounts } from '@/services/accounts';

/** Esercenti degli account già salvati sul telefono, da scegliere con un tocco al posto di scrivere o scansionare il codice. */
export function SavedEsercenti({ selected, onSelect }: { selected: string; onSelect: (code: string, name: string) => void }) {
  const t = useTheme();
  const [items, setItems] = useState<{ codEsercente: string; ragioneSociale: string }[]>([]);

  useEffect(() => {
    listAccounts().then((l) => {
      const seen = new Map<string, string>();
      l.forEach((a) => seen.set(a.codEsercente, a.ragioneSociale));
      setItems([...seen].map(([codEsercente, ragioneSociale]) => ({ codEsercente, ragioneSociale })));
    });
  }, []);

  if (items.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {items.map((e) => {
        const active = selected === e.codEsercente;
        return (
          <Pressable
            key={e.codEsercente}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(e.codEsercente, e.ragioneSociale)}
            style={[styles.chip, { borderColor: active ? t.primary : t.border }]}>
            <Text style={{ color: active ? t.primary : t.text, fontWeight: '600' }}>{e.ragioneSociale}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
});
