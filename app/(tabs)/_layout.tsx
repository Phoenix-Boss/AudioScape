// app/(tabs)/_layout.tsx
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

const COLORS = {
  goldShimmer: "#E6C16A",
  background: "#000000",
  surfaceDark: "#0A0A0A",
};

const TAB_HEIGHT = 56;

function TabLayoutContent() {
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  
  const { resetNavigationState } = useGlobalUIState();
  const lastSegment = useRef(segments.join("/"));

  useEffect(() => {
    const currentSegment = segments.join("/");
    if (currentSegment !== lastSegment.current) {
      resetNavigationState();
      lastSegment.current = currentSegment;
    }
  }, [segments, resetNavigationState]);

  const handleTabPress = (tabName: string) => {
    triggerHaptic();
    router.push(`/(tabs)/${tabName}`);
  };

  const isPlayerScreen = segments[0] === "(player)";

  // Only include actual tabs you want visible
  const tabs = [
    { name: "index", title: "Home", icon: "home" },
    { name: "search", title: "Search", icon: "search" },
    { name: "library", title: "Library", icon: "albums" },
    { name: "settings", title: "Settings", icon: "settings" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Tabs
        screenOptions={{
          tabBarStyle: { display: "none" },
          headerShown: false,
        }}
      >
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color, focused }) => (
                <TabBarIcon
                  name={focused ? tab.icon : `${tab.icon}-outline`}
                  color={color}
                />
              ),
            }}
          />
        ))}
      </Tabs>

      {!isPlayerScreen && (
        <>
          <View
            style={[
              styles.customTabBar,
              { height: TAB_HEIGHT + safeAreaBottom, paddingBottom: safeAreaBottom },
            ]}
          >
            <LinearGradient
              colors={["rgba(18,18,18,0.98)", "rgba(18,18,18,0.95)", COLORS.surfaceDark]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.tabButtonsContainer}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab.name}
                  style={styles.tabButton}
                  onPress={() => handleTabPress(tab.name)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={tab.icon} size={24} color={COLORS.goldShimmer} />
                  <Text style={styles.tabLabel}>{tab.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <FloatingPlayer />
        </>
      )}
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
    zIndex: 10,
    overflow: "hidden",
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
