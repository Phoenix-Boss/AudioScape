// components/ScrollControllerWrapper.tsx
import React, { useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScrollHandler } from "@/hooks/useScrollHandler";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

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
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  
  // ==================== MEASUREMENTS ====================
  const [headerHeight, setHeaderHeight] = useState(0);
  const [tabsHeight, setTabsHeight] = useState(60); // Still need for padding
  
  // ==================== ENTERPRISE HOOKS ====================
  const {
    scrollHandler,
    headerTranslateY
  } = useScrollHandler({
    headerHeight,
  });
  
  // ==================== MEASUREMENTS ====================
  const onHeaderLayout = useCallback((event: any) => {
    setHeaderHeight(event.nativeEvent.layout.height);
  }, []);
  
  const onTabsLayout = useCallback((event: any) => {
    // Still measure tabs for proper padding
    setTabsHeight(event.nativeEvent.layout.height);
  }, []);
  
  // ==================== ANIMATED STYLES ====================
  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
  }));
  
  // ==================== PADDING ====================
  const getBottomPadding = useCallback(() => {
    // Fixed padding for tabs - they never hide
    return tabsHeight;
  }, [tabsHeight]);
  
  // ==================== RENDER ====================
  return (
    <View style={styles.container}>
      {/* Header - Still animated */}
      {showHeader && headerComponent && (
        <Animated.View
          style={[styles.headerContainer, headerAnimatedStyle]}
          onLayout={onHeaderLayout}
        >
          {headerComponent}
        </Animated.View>
      )}
      
      {/* ScrollView */}
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          contentContainerStyle,
          {
            paddingTop: 0,
            paddingBottom: getBottomPadding(), // Fixed tabs padding
          }
        ]}
        onScroll={scrollHandler}
        scrollEventThrottle={1}
        showsVerticalScrollIndicator={false}
        overScrollMode="always"
      >
        {/* Header spacer */}
        {showHeader && <View style={{ height: headerHeight }} />}
        {children}
      </Animated.ScrollView>
      
      {/* Tabs Container - FIXED POSITION */}
      <View 
        style={[
          styles.tabsContainer,
          { 
            height: tabsHeight,
            paddingBottom: safeAreaBottom 
          }
        ]}
        onLayout={onTabsLayout}
      >
        {/* Tabs are rendered by the Tabs Layout, this is just positioning */}
      </View>
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
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: "#000000",
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    width: "100%",
  },
  scrollView: { 
    flex: 1,
    backgroundColor: "transparent",
  },
  contentContainer: { 
    flexGrow: 1,
    backgroundColor: "transparent",
  },
  tabsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    backgroundColor: "#121212",
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
});