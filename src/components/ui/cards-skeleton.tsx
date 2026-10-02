import MaskedView from '@react-native-masked-view/masked-view';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { CARD_SHADOW_CLEARANCE, H, SHAPE, W } from '@/components/ui/flip-card';
import SkeletonLoading from '@/components/ui/skeleton-loading';
import { SkeletonShimmerProvider } from '@/context/skeleton-shimmer';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SKELETON_COUNT = 3;

/** Segnaposto con shimmer mostrato mentre le card vengono caricate dal backend: stessa sagoma e dimensioni delle FlipCard. */
export function CardsSkeleton() {
  const dark = useColorScheme() === 'dark';
  const baseColor = dark ? '#2B3A31' : '#F0F4F1';
  const highlightColor = dark ? '#415347' : '#FFFFFF';

  return (
    <SkeletonShimmerProvider>
      <View style={styles.wrap}>
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <MaskedView
            key={i}
            style={styles.card}
            maskElement={
              <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
                <Path d={SHAPE} fill="#000" />
              </Svg>
            }>
            <SkeletonLoading height="100%" borderRadius={0} baseColor={baseColor} highlightColor={highlightColor} />
          </MaskedView>
        ))}
      </View>
    </SkeletonShimmerProvider>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: CARD_SHADOW_CLEARANCE },
  card: { aspectRatio: W / H },
});
