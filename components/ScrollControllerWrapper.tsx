// app/components/ScrollControllerWrapper.tsx
import React, { useRef, useCallback, useEffect, useState } from "react";
import {
  View,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Animated,
  Easing,
  LayoutAnimation,
  UIManager,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGlobalUIState } from "@/contexts/GlobalUIStateContext";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ScrollControllerWrapperProps {
  children: React.ReactNode;
  headerComponent?: React.ReactNode;
  showHeader?: boolean;
  refreshControl?: React.ReactNode;
  contentContainerStyle?: any;
}

export default function ScrollControllerWrapper({
  children,
  headerComponent,
  showHeader = true,
  refreshControl,
  contentContainerStyle,
}: ScrollControllerWrapperProps) {
  const { top: safeAreaTop, bottom: safeAreaBottom } = useSafeAreaInsets();
  const { 
    tabsVisible, 
    tabsLocked, 
    isMusicPlaying, 
    setTabsVisible 
  } = useGlobalUIState();

  // Animation values - START WITH VISIBLE POSITION
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const tabsTranslateY = useRef(new Animated.Value(0)).current;
  
  // Track whether header is hidden
  const [headerHidden, setHeaderHidden] = useState(false);
  const [tabsHeight, setTabsHeight] = useState(60); // Default tab height
  
  // Set initial height for combined header (search + categories)
  const [headerHeight, setHeaderHeight] = useState(0); // Start at 0, will be measured

  // Scroll tracking
  const lastScrollY = useRef(0);
  const scrollThreshold = 20;

  // Measure header height
  const onHeaderLayout = useCallback((event: any) => {
    const height = event.nativeEvent.layout.height;
    // Set the actual measured height
    setHeaderHeight(height);
  }, []);

  // Measure tabs height
  const onTabsLayout = useCallback((event: any) => {
    const height = event.nativeEvent.layout.height;
    setTabsHeight(height);
  }, []);

  // Header slide animation - COMPLETE hide/show
  const slideHeader = useCallback((show: boolean) => {
    setHeaderHidden(!show);
    
    // When hiding: header moves up by its full height
    const toValue = show ? 0 : -headerHeight;
    
    Animated.timing(headerTranslateY, {
      toValue,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [headerHeight, headerTranslateY]);

  // Tabs slide animation - SMOOTH slide in/out
  const slideTabs = useCallback((show: boolean) => {
    // When hiding: tabs move down by their full height
    const toValue = show ? 0 : tabsHeight;
    
    Animated.timing(tabsTranslateY, {
      toValue,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tabsHeight, tabsTranslateY]);

  // Handle scroll with REVERSED behavior (down hides, up shows)
  const handleScroll = useCallback((event: any) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const scrollDiff = currentScrollY - lastScrollY.current;
    
    // Determine scroll direction with threshold
    const scrollingUp = scrollDiff < -scrollThreshold;   // Content moving UP
    const scrollingDown = scrollDiff > scrollThreshold;  // Content moving DOWN
    
    lastScrollY.current = currentScrollY;

    // REVERSED BEHAVIOR:
    // Scroll DOWN → HIDE UI (content moving downward = hide for immersion)
    // Scroll UP → SHOW UI (content moving upward = show for navigation)
    
    if (scrollingDown && !headerHidden) {
      slideHeader(false); // Hide header on scroll DOWN
    } else if (scrollingUp && headerHidden) {
      slideHeader(true);  // Show header on scroll UP
    }

    // MUSIC-AWARE TAB BEHAVIOR
    // ================================================
    
    // CASE 1: Music is playing → tabs are handle-controlled only
    if (isMusicPlaying) {
      // If tabs are locked, ignore scroll completely (respect user choice)
      if (tabsLocked) return;
      
      // If tabs are not locked, use smooth slide animation
      if (scrollingDown && tabsVisible) {
        slideTabs(false); // Hide tabs smoothly on scroll DOWN
        setTabsVisible(false, false);
      } else if (scrollingUp && !tabsVisible && !tabsLocked) {
        slideTabs(true); // Show tabs smoothly on scroll UP
        setTabsVisible(true, false);
      }
      return;
    }
    
    // CASE 2: No music playing → REVERSED scroll behavior with smooth animation
    if (scrollingDown && tabsVisible) {
      // Scroll DOWN → hide tabs (slide DOWN off screen)
      slideTabs(false);
      setTabsVisible(false, false);
    } else if (scrollingUp && !tabsVisible) {
      // Scroll UP → show tabs (slide UP from bottom)
      slideTabs(true);
      setTabsVisible(true, false);
    }
  }, [
    isMusicPlaying, 
    tabsLocked, 
    tabsVisible, 
    setTabsVisible, 
    slideHeader,
    slideTabs,
    scrollThreshold,
    headerHidden
  ]);

  // Header container style - Spotify style (no space before search bar)
  const headerContainerStyle = {
    transform: [{ translateY: headerTranslateY }],
    minHeight: 100, // Keep minimum height
    top: 0, // Always at top
  };

  // Tabs positioning - bottom aligned with smooth slide
  const tabsContainerStyle = {
    transform: [{ translateY: tabsTranslateY }],
    bottom: 0, // Anchor to bottom
  };

  // Content padding - matches reference design
  // Use the actual measured headerHeight for accurate positioning
  const contentPaddingTop = showHeader ? headerHeight : 0;

  return (
    <View style={styles.container}>
      {/* COMBINED HEADER - Search + Categories in one component */}
      {showHeader && headerComponent && (
        <Animated.View
          style={[
            styles.headerContainer,
            { 
              // SPOTIFY STYLE: No paddingTop - navbar starts flush with status bar
              backgroundColor: "#000000",
            },
            headerContainerStyle
          ]}
          onLayout={onHeaderLayout}
        >
          {headerComponent}
        </Animated.View>
      )}

      {/* ScrollView with dynamic positioning */}
      <ScrollView
        style={[
          styles.scrollView,
        ]}
        contentContainerStyle={[
          styles.contentContainer,
          contentContainerStyle,
          { 
            // Critical fix: Use measured headerHeight for proper content positioning
            paddingTop: contentPaddingTop,
            // Add padding for tabs at bottom
            paddingBottom: tabsHeight,
          }
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={refreshControl as any}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>

      {/* Tabs Container - For positioning only */}
      <View 
        style={styles.tabsLayoutContainer}
        onLayout={onTabsLayout}
        pointerEvents="box-none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: "#000000",
  },
  headerContainer: {
    position: "absolute",
    top: 0, // Start at very top of screen
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "#000000",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    width: "100%",
    // Removed fixed height - now uses minHeight and measured height
  },
  scrollView: { 
    flex: 1,
  },
  contentContainer: { 
    flexGrow: 1,
  },
  tabsLayoutContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99,
  },
});