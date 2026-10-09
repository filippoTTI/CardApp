import { Check, QrCode } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassPanel } from '@/components/ui/glass-panel';
import { QrScanner } from '@/components/ui/qr-scanner';
import { TextField } from '@/components/ui/text-field';
import { useRadius } from '@/context/ui-scale';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/services/api';
import { fetchEsercente } from '@/services/auth';

const MIN_LENGTH = 4;
const DEBOUNCE_MS = 500;

/**
 * Scelta dell'esercente quando non si arriva da un link/QR: prima il tasto con la fotocamera per leggere il QR, poi il campo
 * per scrivere il codice a mano. Il codice viene verificato sul server mentre lo si digita (o subito dopo la scansione) e
 * sotto il campo compare il nome dell'esercente; il genitore riceve il codice e, se valido, il nome.
 */
export function EsercenteCodeField({ code, name, onChange }: { code: string; name?: string; onChange: (code: string, name?: string) => void }) {
  const t = useTheme();
  const radius = useRadius();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>();

  // si sta verificando finché il codice è abbastanza lungo e non c'è ancora né nome né errore
  const checking = !name && !error && code.length >= MIN_LENGTH;

  // verifica con il server dopo una breve pausa nella digitazione (o subito dopo una scansione)
  useEffect(() => {
    if (name || code.length < MIN_LENGTH) return;
    let active = true;
    const timer = setTimeout(() => {
      fetchEsercente(code)
        .then((e) => {
          if (active) onChange(code, e.ragioneSociale);
        })
        .catch((e) => {
          if (active) setError(e instanceof ApiError ? (e.cod === -1 ? 'Impossibile verificare il codice: server non raggiungibile' : 'Codice esercente non valido') : 'Errore imprevisto');
        });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // onChange cambia a ogni render del genitore: conta solo il codice digitato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name]);

  // scrittura o scansione: il risultato della verifica precedente non vale più
  const change = (c: string) => {
    setError(undefined);
    onChange(c, undefined);
  };

  return (
    <View style={styles.wrap}>
      <Pressable accessibilityRole="button" accessibilityLabel="Scansiona il QR dell'esercente" onPress={() => setScanning(true)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
        <GlassPanel radius={radius.md} style={styles.scan}>
          <QrCode size={26} color={t.primary} strokeWidth={2} />
          <Text style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>Scansiona il QR dell&apos;esercente</Text>
        </GlassPanel>
      </Pressable>
      <Text style={[styles.or, { color: t.textSecondary }]}>oppure inserisci il codice</Text>
      <TextField
        label="Codice esercente"
        placeholder="Codice ricevuto dall'esercente"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={(v) => change(v.trim().toUpperCase())}
        error={error}
      />
      {name ? (
        <View style={styles.found}>
          <Check size={16} color={t.primary} strokeWidth={3} />
          <Text style={{ color: t.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
            {name}
          </Text>
        </View>
      ) : checking ? (
        <Text style={{ color: t.textSecondary, fontSize: 13 }}>Verifica del codice…</Text>
      ) : null}
      <QrScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onCode={(c) => {
          setScanning(false);
          change(c);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  scan: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, height: 58 },
  or: { fontSize: 13, textAlign: 'center' },
  found: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
