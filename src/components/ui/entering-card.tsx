import { useState, type ReactNode } from 'react';
import Animated, { FadeInDown, runOnJS } from 'react-native-reanimated';

/**
 * Compare con dissolvenza e piccola salita. Finché dura l'animazione la card viene "rasterizzata"
 * (disegnata una volta sola come immagine), così animarne l'opacità è leggerissimo anche con SVG e ombre;
 * a fine animazione torna normale, perché il flip 3D ha bisogno di ridisegnarla.
 */
export function EnteringCard({ index, children }: { index: number; children: ReactNode }) {
  const [settled, setSettled] = useState(false);
  return (
    <Animated.View
      entering={FadeInDown.delay(250 + index * 150)
        .duration(550)
        .withCallback((finished) => {
          'worklet';
          if (finished) runOnJS(setSettled)(true);
        })}
      shouldRasterizeIOS={!settled}
      renderToHardwareTextureAndroid={!settled}>
      {children}
    </Animated.View>
  );
}
