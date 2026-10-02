import { LinearGradient } from 'expo-linear-gradient';
import { memo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useSkeletonShimmer } from '@/context/skeleton-shimmer';

const BAND_WIDTH_RATIO = 0.5;

export type SkeletonLoadingProps = {
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  baseColor?: string;
  highlightColor?: string;
};

function SkeletonLoading({
  width = '100%',
  height = 16,
  borderRadius = 10,
  style,
  baseColor = '#E7E9EE',
  highlightColor = '#F4F6F9',
}: SkeletonLoadingProps) {
  const [boxWidth, setBoxWidth] = useState(0);
  const progress = useSkeletonShimmer();
  const bandWidth = boxWidth * BAND_WIDTH_RATIO;

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -bandWidth + progress.value * (boxWidth + bandWidth) }],
  }));

  return (
    <View
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius, backgroundColor: baseColor, overflow: 'hidden' }, style]}>
      {boxWidth > 0 ? (
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: bandWidth }, shimmerStyle]} pointerEvents="none">
          <LinearGradient
            colors={[baseColor, highlightColor, baseColor]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

export default memo(SkeletonLoading);
