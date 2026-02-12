// hooks/useScrollHandler.ts
import { useCallback } from 'react';
import { useScrollLogic } from './useScrollLogic';
import { useScrollAnimations } from './useScrollAnimations';
import {
  useAnimatedScrollHandler,
  useSharedValue
} from 'react-native-reanimated';

interface ScrollHandlerConfig {
  headerHeight: number;
}

export const useScrollHandler = (config: ScrollHandlerConfig) => {
  const { headerHeight } = config;
  
  // Get logic (only music state needed)
  const logic = useScrollLogic();
  
  // Get animations
  const animations = useScrollAnimations();

  // ==================== SCROLL TRACKING ====================
  const lastScrollY = useSharedValue(0);
  const lastDirection = useSharedValue<'up' | 'down' | null>(null);

  // ==================== SCROLL HANDLER WORKLET ====================
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      'worklet';
      
      // ============ EXTRACT VALUES ============
      const currentY = event.contentOffset.y;
      const diff = currentY - lastScrollY.value;
      lastScrollY.value = currentY;
      
      // ============ MIN SCROLL CHECK ============
      const MIN_SCROLL = 10; // Fixed threshold
      if (Math.abs(diff) < MIN_SCROLL) return;
      
      // ============ DIRECTION ============
      const direction = diff > 0 ? 'down' : 'up';
      if (lastDirection.value === direction) return;
      lastDirection.value = direction;
      
      // ============ HEADER LOGIC ONLY ============
      // Tabs are fixed, only header hides/shows
      const isHeaderHidden = animations.isHeaderHidden.value;
      
      if (direction === 'down' && !isHeaderHidden) {
        animations.slideHeader(true, headerHeight);
      } else if (direction === 'up' && isHeaderHidden) {
        animations.slideHeader(false, headerHeight);
      }
    },
    
    onBeginDrag: () => {
      'worklet';
      lastDirection.value = null;
    }
  });

  // ==================== RETURN VALUES ====================
  return {
    // Scroll handler
    scrollHandler,
    
    // Animation values (for styles)
    headerTranslateY: animations.headerTranslateY,
    
    // Manual controls
    showHeader: () => {
      'worklet';
      animations.slideHeader(false, headerHeight);
    },
    hideHeader: () => {
      'worklet';
      animations.slideHeader(true, headerHeight);
    },
    
    // Logic values (for debugging)
    isMusicPlaying: logic.isMusicPlayingValue,
    isHeaderHidden: animations.isHeaderHidden
  };
};