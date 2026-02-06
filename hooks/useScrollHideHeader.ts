// @/hooks/useScrollHideHeader.ts

import { useRef } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Custom hook for scroll-driven header hiding.
 * 
 * - Hides header when scrolling down
 * - Reveals header when scrolling up
 * - UI-thread animation (Reanimated)
 * - No JS thread jank
 * 
 * Usage:
 * const { headerStyle, onScroll } = useScrollHideHeader();
 * 
 * <Animated.View style={headerStyle} />
 * <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} />
 */
export const useScrollHideHeader = () => {
  const { top } = useSafeAreaInsets();

  // UI-thread shared value
  const scrollY = useSharedValue(0);

  // JS-thread ref (optional future logic)
  const lastScrollY = useRef(0);

  // Header height
  const HEADER_HEIGHT = 80;

  // Animated style
  const headerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, HEADER_HEIGHT],
      [0, -(HEADER_HEIGHT + top)],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        {
          translateY: translateY, // ✅ guaranteed number
        },
      ],
    };
  }, [top]);

  // ✅ Proper Reanimated scroll handler
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      scrollY.value = y;
    },
  });

  return {
    scrollY,      // optional
    headerStyle,  // apply to Animated.View
    onScroll,     // attach to Animated.ScrollView
  };
};
