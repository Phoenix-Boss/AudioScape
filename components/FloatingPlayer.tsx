import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Platform,
  GestureResponderEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { triggerHaptic } from "@/helpers/haptics";
import {
  useActiveTrack,
  usePlaybackState,
  useProgress,
  TrackPlayer,
  State,
} from "react-native-track-player";
import Animated, {
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useGlobalUIState } from "@/contexts/GlobalUIStateContext";

const { width } = Dimensions.get("window");

interface FloatingPlayerProps {
  tabHeight?: number;
}

export default function FloatingPlayer({
  tabHeight = 56,
}: FloatingPlayerProps) {
  const router = useRouter();
  const activeTrack = useActiveTrack();
  const playbackState = usePlaybackState();
  const isPlaying = playbackState.state === State.Playing;

  const { handleVisible, isMusicPlaying } = useGlobalUIState();

  const { position, duration } = useProgress();
  const progressPercentage = duration > 0 ? position / duration : 0;
  const progressBarRef = useRef<View>(null);

  const togglePlay = async () => {
    triggerHaptic();
    try {
      if (isPlaying) {
        await TrackPlayer.pause();
      } else {
        await TrackPlayer.play();
      }
    } catch (error) {
      console.error("Error toggling playback:", error);
    }
  };

  const playNextSong = async () => {
    triggerHaptic();
    try {
      await TrackPlayer.skipToNext();
    } catch (error) {
      console.error("Error playing next song:", error);
    }
  };

  const openPlayerScreen = () => {
    triggerHaptic();
    if (!activeTrack) return;

    router.push("/(player)");
  };

  const handleProgressBarPress = async (event: GestureResponderEvent) => {
    if (!progressBarRef.current || !duration) return;

    triggerHaptic("light");

    try {
      const touchX = event.nativeEvent.locationX;
      progressBarRef.current.measure((x, y, progressWidth) => {
        const percentage = Math.max(0, Math.min(1, touchX / progressWidth));
        const seekPosition = duration * percentage;
        TrackPlayer.seekTo(seekPosition);
      });
    } catch (error) {
      console.error("Error seeking:", error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Position the player directly above the tab bar, edge to edge
  const floatingPlayerBottom = tabHeight + 45; // 4px gap above tab bar
  const floatingPlayerWidth = width; // Full width edge-to-edge

  const animatedStyle = useAnimatedStyle(() => {
    return {
      bottom: withTiming(floatingPlayerBottom, { duration: 300 }),
    };
  }, [floatingPlayerBottom]);

  const progressAnimatedStyle = useAnimatedStyle(() => {
    return {
      width: `${progressPercentage * 100}%`,
    };
  }, [progressPercentage]);

  if (!activeTrack || !handleVisible || !isMusicPlaying) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.floatingWrapper,
        { width: floatingPlayerWidth },
        animatedStyle,
      ]}
    >
      {/* Glass blur base layer */}
      <View style={styles.glassBaseLayer}>
        {/* Subtle gradient overlay for depth */}
        <View style={styles.glassGradientOverlay} />

        {/* Glass texture effect */}
        <View style={styles.glassTexture} />
      </View>

      <View style={[styles.floatingCard, { width: floatingPlayerWidth }]}>
        {/* Main content */}
        <TouchableOpacity
          style={styles.contentContainer}
          onPress={openPlayerScreen}
          activeOpacity={0.9}
        >
          {/* Progress Bar Container - Moved to top of player */}
          <View style={styles.progressContainer}>
            <TouchableOpacity
              style={styles.progressTouchArea}
              onPress={handleProgressBarPress}
              activeOpacity={0.9}
              ref={progressBarRef}
            >
              <View style={styles.progressBackground} />
              <Animated.View
                style={[styles.progressBar, progressAnimatedStyle]}
              />
            </TouchableOpacity>
          </View>

          {/* Album Art */}
          <View style={styles.albumArtContainer}>
            {activeTrack.artwork ? (
              <Image
                source={{ uri: activeTrack.artwork }}
                style={styles.albumArt}
              />
            ) : (
              <View style={styles.albumArtPlaceholder}>
                <Ionicons
                  name="musical-notes"
                  size={24}
                  color="rgba(255, 255, 255, 0.7)"
                />
              </View>
            )}
          </View>

          {/* Track Info */}
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>
              {activeTrack.title || "Unknown Title"}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {activeTrack.artist || "Unknown Artist"}
            </Text>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, styles.nextButton]}
              onPress={(e) => {
                e.stopPropagation();
                playNextSong();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="play-skip-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, styles.playButton]}
              onPress={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={22}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 999,
  },

  floatingCard: {
    height: 55,
    borderRadius: 0,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",

    // Enhanced shadow for better separation from tab bar
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 20,
  },

  glassBaseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Platform.select({
      ios: "rgba(40, 40, 45, 0.75)", // Dark glass for iOS
      android: "rgba(35, 35, 40, 0.85)", // Slightly more opaque for Android
      default: "rgba(38, 38, 43, 0.8)",
    }),
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.2)",
  },

  glassGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    backgroundImage:
      "linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
  },

  glassTexture: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    opacity: 0.03,
  },

  contentContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    zIndex: 1,
  },

  albumArtContainer: {
    marginRight: 12,
    zIndex: 1,
  },

  albumArt: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },

  albumArtPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },

  trackInfo: {
    flex: 1,
    justifyContent: "center",
    marginRight: 10,
    zIndex: 1,
  },

  trackTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 2,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  trackArtist: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 12,
    letterSpacing: 0.2,
    textShadowColor: "rgba(0, 0, 0, 0.4)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 1,
  },

  controlButton: {
    justifyContent: "center",
    alignItems: "center",
  },

  nextButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginLeft: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },

  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    marginLeft: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },

  progressContainer: {
    position: "absolute",
    bottom: 50,
    left: 16,
    right: 16,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    zIndex: 2,
  },

  progressTouchArea: {
    flex: 1,
    justifyContent: "center",
  },

  progressBackground: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },

  progressBar: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFF",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
  },
});
