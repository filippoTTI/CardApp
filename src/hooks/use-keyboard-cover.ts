import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type View } from 'react-native';

/**
 * Quanto la tastiera copre il fondo di una vista, misurato sul layout reale: funziona sia quando Android ridimensiona la
 * finestra (copertura 0) sia quando non lo fa (iOS e Android edge-to-edge). Si collega `ref` e `onLayout` alla vista e
 * `paddingBottom` si applica al suo stile, così il contenuto resta tutto sopra la tastiera.
 */
export function useKeyboardCover() {
  const ref = useRef<View>(null);
  const keyboardTop = useRef<number | null>(null);
  const [paddingBottom, setPaddingBottom] = useState(0);

  const sync = useCallback(() => {
    const top = keyboardTop.current;
    if (top === null) {
      setPaddingBottom(0);
      return;
    }
    ref.current?.measureInWindow((_x, y, _w, h) => setPaddingBottom(Math.max(0, y + h - top)));
  }, []);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      sync();
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTop.current = null;
      sync();
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [sync]);

  return { ref, onLayout: sync, paddingBottom };
}
