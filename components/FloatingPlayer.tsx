import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { triggerHaptic } from "@/helpers/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveTrack, usePlaybackState, useProgress } from "react-native-track-player";
import { State } from "react-native-track-player";
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useGlobalUIState } from "@/contexts/GlobalUIStateContext";

const { width } = Dimensions.get("window");

const COLORS = {
  background: "#000000",
  surface: "#121212",
  surfaceLight: "#1F1F1F",
  surfaceDark: "#0A0A0A",
  goldPrimary: "#D4AF37",
  goldShiny: "#FFD700",
  goldRich: "#BF9B30",
  goldShimmer: "#E6C16A",
  textPrimary: "#FFFFFF",
  textSecondary: "#B3B3B3",
  textTertiary: "#808080",
  border: "#333333",
  white: "#FFFFFF",
};

const TAB_HEIGHT = 56;
const NOW_PLAYING_HEIGHT = 68;
const HANDLE_WIDTH = 40;
const HANDLE_HEIGHT = 4;
const HANDLE_VERTICAL_OFFSET = 12;

interface FloatingPlayerProps {}

export default function FloatingPlayer({}: FloatingPlayerProps) {
  const router = useRouter();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state === State.Playing;
  
  const {
    tabsVisible,
    setTabsVisible,
    handleVisible,
    isMusicPlaying,
  } = useGlobalUIState();
  
  const { position, duration } = useProgress();
  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  const togglePlay = () => {
    triggerHaptic();
    console.log("Toggle play");
  };

  const playNextSong = () => {
    triggerHaptic();
    console.log("Play next song");
  };

  const openPlayerScreen = () => {
    triggerHaptic();
    if (!activeTrack) return;

    router.push("/player");
  };

  const toggleTabs = () => {
    triggerHaptic();
    const newVisibility = !tabsVisible;
    setTabsVisible(newVisibility, true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const playbackUnitBottom = tabsVisible 
    ? TAB_HEIGHT + safeAreaBottom 
    : safeAreaBottom;

  const playbackUnitAnimatedStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(playbackUnitBottom, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      }),
    };
  }, [playbackUnitBottom]);

  const progressAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progressPercentage}%`,
    };
  }, [progressPercentage]);

  if (!activeTrack || !handleVisible || !isMusicPlaying) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.playbackUnitContainer,
        playbackUnitAnimatedStyle
      ]}
    >
      <TouchableOpacity
        style={styles.handleContainer}
        onPress={toggleTabs}
        activeOpacity={0.7}
        hitSlop={{ top: 16, bottom: 16, left: 20, right: 20 }}
      >
        <View style={styles.handleBar} />
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.nowPlayingCard}
        onPress={openPlayerScreen}
        activeOpacity={0.9}
      >
        <View style={styles.nowPlayingBackground} />
        
        <View style={styles.progressContainer}>
          <Animated.View style={[styles.progressFill, progressAnimatedStyle]} />
        </View>
        
        <View style={styles.nowPlayingContent}>
          <View style={styles.albumArtContainer}>
            {activeTrack.artwork ? (
              <Image
                source={{ uri: activeTrack.artwork }}
                style={styles.albumArt}
              />
            ) : (
              <View style={styles.albumArtPlaceholder}>
                <Ionicons name="musical-notes" size={24} color={COLORS.textSecondary} />
              </View>
            )}
          </View>
          
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {activeTrack.title || "Unknown Title"}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {activeTrack.artist || "Unknown Artist"}
            </Text>
          </View>
          
          <View style={styles.controls}>
            <TouchableOpacity 
              style={styles.playPauseButton}
              onPress={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={24} 
                color={COLORS.textPrimary} 
              />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.nextButton}
              onPress={(e) => {
                e.stopPropagation();
                playNextSong();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons 
                name="play-skip-forward" 
                size={20} 
                color={COLORS.textPrimary} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  playbackUnitContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 999,
  },
  
  handleContainer: {
    position: "absolute",
    top: -HANDLE_VERTICAL_OFFSET,
    left: 0,
    right: 0,
    height: HANDLE_HEIGHT + 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  
  handleBar: {
    width: HANDLE_WIDTH,
    height: HANDLE_HEIGHT,
    backgroundColor: COLORS.goldShimmer,
    borderRadius: 2,
    opacity: 0.9,
  },
  
  nowPlayingCard: {
    marginHorizontal: 16,
    height: NOW_PLAYING_HEIGHT,
    backgroundColor: COLORS.surfaceDark,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 14,
  },
  
  nowPlayingBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.surfaceDark,
  },
  
  progressContainer: {
    position: "absolute",
    top: 8,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
  },
  
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.goldPrimary,
  },
  
  nowPlayingContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
    height: "100%",
  },
  
  albumArtContainer: {
    marginRight: 12,
  },
  
  albumArt: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  
  albumArtPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  
  trackInfo: {
    flex: 1,
    marginRight: 12,
    overflow: "hidden",
  },
  
  trackTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  
  trackArtist: {
    fontSize: 12,
    fontWeight: "400",
    color: COLORS.textSecondary,
    letterSpacing: -0.3,
  },
  
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  
  playPauseButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
  },
  
  nextButton: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
  },
});