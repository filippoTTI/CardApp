import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { withoutLock } from '@/context/app-lock';
import { useTheme } from '@/hooks/use-theme';
import { parseEsercenteCode } from '@/services/esercente-qr';
import { optionalNative } from '@/services/optional-native';

type CameraModule = typeof import('expo-camera');

// Senza il modulo nativo della fotocamera lo scanner dice solo che non è disponibile.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const camera = optionalNative('camera', () => require('expo-camera') as CameraModule)();

type ScannerProps = {
  visible: boolean;
  onClose: () => void;
  onCode: (code: string) => void;
  /** Estrae il codice dal testo del QR (null se non è un QR atteso). Predefinito: QR dell'esercente. */
  parse?: (data: string) => string | null;
  /** Testo sotto l'inquadratura. */
  hint?: string;
  /** Avviso quando il QR letto non è quello atteso. */
  invalidHint?: string;
};

/**
 * Fotocamera integrata a schermo intero per leggere un QR: per impostazione predefinita quello dell'esercente
 * (`cardapp://e/<codice>`), oppure un altro con `parse` (es. il pagamento in cassa, `cardapp://pay/<id>`).
 * Alla prima lettura valida chiama `onCode` con il codice; il chiamante chiude lo scanner.
 */
export function QrScanner({ visible, onClose, onCode, parse = parseEsercenteCode, hint, invalidHint }: ScannerProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaProvider>
        {camera ? (
          <ScannerBody onClose={onClose} onCode={onCode} parse={parse} hint={hint} invalidHint={invalidHint} />
        ) : (
          <Unavailable onClose={onClose} />
        )}
      </SafeAreaProvider>
    </Modal>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Chiudi" onPress={onClose} hitSlop={10} style={styles.close}>
      <X size={24} color="#FFFFFF" strokeWidth={2.4} />
    </Pressable>
  );
}

function Unavailable({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.fill, styles.center, { backgroundColor: t.background }]}>
      <SafeAreaView style={styles.fill}>
        <Pressable accessibilityRole="button" accessibilityLabel="Chiudi" onPress={onClose} hitSlop={10} style={styles.closeLight}>
          <X size={24} color={t.text} strokeWidth={2.4} />
        </Pressable>
        <View style={[styles.fill, styles.center, styles.padded]}>
          <Text style={[styles.title, { color: t.text }]}>Scanner non disponibile</Text>
          <Text style={[styles.message, { color: t.textSecondary }]}>La lettura del QR richiede un aggiornamento dell&apos;app. Nel frattempo puoi inserire il codice a mano.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ScannerBody({ onClose, onCode, parse, hint: idleHint, invalidHint }: Omit<ScannerProps, 'visible'> & { parse: (data: string) => string | null }) {
  const t = useTheme();
  const { CameraView, useCameraPermissions } = camera as CameraModule;
  const [permission, requestPermission] = useCameraPermissions();
  const [hint, setHint] = useState<string>();
  const handled = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const onScanned = ({ data }: { data: string }) => {
    if (handled.current) return;
    const code = parse(data);
    if (code) {
      handled.current = true;
      onCode(code);
      return;
    }
    setHint(invalidHint ?? 'Questo QR non è di un esercente CardApp');
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(undefined), 2500);
  };

  if (!permission) return <View style={[styles.fill, { backgroundColor: t.background }]} />;

  if (!permission.granted) {
    return (
      <View style={[styles.fill, { backgroundColor: t.background }]}>
        <SafeAreaView style={styles.fill}>
          <Pressable accessibilityRole="button" accessibilityLabel="Chiudi" onPress={onClose} hitSlop={10} style={styles.closeLight}>
            <X size={24} color={t.text} strokeWidth={2.4} />
          </Pressable>
          <View style={[styles.fill, styles.center, styles.padded]}>
            <Text style={[styles.title, { color: t.text }]}>Serve la fotocamera</Text>
            <Text style={[styles.message, { color: t.textSecondary }]}>Per leggere il QR dell&apos;esercente l&apos;app deve poter usare la fotocamera. L&apos;immagine non viene salvata né inviata.</Text>
            {permission.canAskAgain ? (
              <Button title="Consenti la fotocamera" onPress={() => void withoutLock(requestPermission)} />
            ) : (
              <Button title="Apri le impostazioni" onPress={() => void Linking.openSettings()} />
            )}
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#000000' }]}>
      <CameraView style={styles.fill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScanned} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <View style={styles.frame} />
      </View>
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <CloseButton onClose={onClose} />
        <View style={styles.bottom} pointerEvents="none">
          <Text style={styles.hint}>{hint ?? idleHint ?? "Inquadra il QR dell'esercente"}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const FRAME = 240;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  padded: { paddingHorizontal: 32, gap: 16 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between' },
  close: { margin: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  closeLight: { margin: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME, borderRadius: 28, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  bottom: { alignItems: 'center', paddingBottom: 56, paddingHorizontal: 24 },
  hint: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 15, textAlign: 'center', lineHeight: 21 },
});
