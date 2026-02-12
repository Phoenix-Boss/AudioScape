// hooks/useScrollAnimations.ts
import { useCallback } from 'react';
import {
  useSharedValue,
  withTiming,
  cancelAnimation
} from 'react-native-reanimated';

interface AnimationConfig {
  duration?: number;
}

export const useScrollAnimations = (config: AnimationConfig = {}) => {
  const { duration = 250 } = config;

  // ==================== ANIMATION VALUES ====================
  const headerTranslateY = useSharedValue(0);
  const isHeaderHidden = useSharedValue(false);

  // ==================== WORKLET FUNCTIONS ====================
  const slideHeader = useCallback((hide: boolean, headerHeight: number) => {
    'worklet';
    
    cancelAnimation(headerTranslateY);
    
    headerTranslateY.value = withTiming(
      hide ? -headerHeight : 0,
      { duration }
    );
    
    isHeaderHidden.value = hide;
  }, [duration]);

  const resetHeader = useCallback(() => {
    'worklet';
    cancelAnimation(headerTranslateY);
    headerTranslateY.value = 0;
    isHeaderHidden.value = false;
  }, []);

  // ==================== RETURN VALUES ====================
  return {
    // Animation worklets
    slideHeader,
    resetHeader,
    
    // Animation values
    headerTranslateY,
    isHeaderHidden,
    
    // Config
    animationDuration: duration
  };
};