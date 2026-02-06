import React, { useRef, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Text } from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale } from "react-native-size-matters/extend";
import FloatingPlayer from "@/components/FloatingPlayer";
import { Ionicons } from "@expo/vector-icons";
import { triggerHaptic } from "@/helpers/haptics";
import { useGlobalUIState } from "@/contexts/GlobalUIStateContext";
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

const COLORS = {
  goldPrimary: "#D4AF37",
  goldShiny: "#FFD700",
  goldRich: "#BF9B30",
  goldShimmer: "#E6C16A",
  goldBronze: "#8C6F0E",
  goldMuted: "#C9A96A",
  text: "#FFFFFF",
  textSecondary: "#B3B3B3",
  textTertiary: "#808080",
  background: "#000000",
  surface: "#121212",
  surfaceLight: "#1F1F1F",
  surfaceDark: "#0A0A0A",
  border: "#333333",
  white: "#FFFFFF",
};

const TAB_HEIGHT = 56;

function TabLayoutContent() {
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  
  const {
    tabsVisible,
    tabsLocked,
    isMusicPlaying,
    resetNavigationState,
  } = useGlobalUIState();

  const lastSegment = useRef(segments.join("/"));

  useEffect(() => {
    const currentSegment = segments.join("/");
    if (currentSegment !== lastSegment.current) {
      resetNavigationState();
      lastSegment.current = currentSegment;
    }
  }, [segments, resetNavigationState]);

  // Tab animation: slide DOWN to hide, slide UP to show
  // When visible: translateY = 0 (at bottom edge)
  // When hidden: translateY = TAB_HEIGHT + safeAreaBottom (off screen below)
  const tabAnimatedStyle = useAnimatedStyle(() => {
    const translateY = tabsVisible 
      ? 0 
      : TAB_HEIGHT + safeAreaBottom;
    
    return {
      transform: [{ translateY }],
    };
  }, [tabsVisible, safeAreaBottom]);

  const handleTabPress = (tabName: string) => {
    triggerHaptic();
    router.push(`/${tabName}`);
  };

  const tabs = [
    { name: "index", title: "Home", icon: "home", iconOutline: "home-outline" },
    { name: "search", title: "Search", icon: "search", iconOutline: "search-outline" },
    { name: "library", title: "Library", icon: "albums", iconOutline: "albums-outline" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Tabs
        screenOptions={{
          tabBarStyle: {
            display: "none",
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? "home" : "home-outline"}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? "search" : "search-outline"}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Library",
            tabBarIcon: ({ color, focused }) => (
              <TabBarIcon
                name={focused ? "albums" : "albums-outline"}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="player"
          options={{
            href: null,
            headerShown: false,
          }}
        />
        <Tabs.Screen 
          name="settings" 
          options={{ 
            href: null 
          }} 
        />
      </Tabs>

      {/* CUSTOM TAB BAR - Slides DOWN to hide, UP to show */}
      <Animated.View 
        style={[
          styles.customTabBar,
          { 
            height: TAB_HEIGHT + safeAreaBottom,
            paddingBottom: safeAreaBottom,
          },
          tabAnimatedStyle
        ]}
      >
        <LinearGradient
          colors={[
            "rgba(18,18,18,0.98)",
            "rgba(18,18,18,0.95)",
            COLORS.surfaceDark
          ]}
          style={StyleSheet.absoluteFill}
        />
        
        <View style={styles.tabBarGoldBorder} />
        
        <View style={styles.tabButtonsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabButton}
              onPress={() => handleTabPress(tab.name)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab.icon}
                size={24}
                color={COLORS.goldShimmer}
              />
              <Text style={styles.tabLabel}>{tab.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
      
      <FloatingPlayer />
    </View>
  );
}

export default function TabLayout() {
  return <TabLayoutContent />;
}

const styles = StyleSheet.create({
  customTabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.goldPrimary + "40",
    zIndex: 10,
    overflow: "hidden",
  },
  tabBarGoldBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.goldPrimary + "60",
  },
  tabButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    flex: 1,
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 8,
  },
  tabLabel: {
    fontSize: moderateScale(10),
    fontWeight: "600",
    color: COLORS.goldShimmer,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});