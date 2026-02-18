// app/(player)/index.tsx

import { MovingText } from "@/components/MovingText";
import VerticalSwipeGesture from "@/components/navigation/VerticalGesture";
import { PlayerProgressBar } from "@/components/PlayerProgressbar";
import { screenPadding } from "@/constants/tokens";
import { triggerHaptic } from "@/helpers/haptics";
import { useImageColors } from "@/hooks/useImageColors";
import { Image } from "expo-image";
import {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  moderateScale,
  scale,
  verticalScale,
} from "react-native-size-matters/extend";
import { useRef, useState, useCallback, useMemo } from "react";
import { z } from "zod";

const PlayerTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  artwork: z.union([z.string(), z.number()]).optional(),
  duration: z.number(),
  videoId: z.string(),
});

type PlayerTrack = z.infer<typeof PlayerTrackSchema>;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const getImageSource = (artwork: string | number | undefined) => {
  if (!artwork) return require("@/assets/images/icon.png");
  if (typeof artwork === "number") return artwork;
  return { uri: artwork };
};

export default function PlayerScreen() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const [imageError, setImageError] = useState(false);

  const currentTrack: PlayerTrack = useMemo(
    () => ({
      id: "1",
      title: "Sample Track",
      artist: "Sample Artist",
      album: "Single",
      artwork: require("@/assets/images/mavins.png"),
      duration: 200,
      videoId: "sample-video-123",
    }),
    []
  );

  const validatedTrack = PlayerTrackSchema.parse(currentTrack);

  const artworkForColors =
    !imageError && typeof validatedTrack.artwork === "string"
      ? validatedTrack.artwork
      : null;

  const { imageColors } = useImageColors(artworkForColors);

  const gradientColors = useMemo(() => {
    if (imageColors?.dominant) {
      return [imageColors.dominant, "#000", "#000"];
    }
    return ["#1a0f05", "#0b0b0b", "#050505"];
  }, [imageColors]);

  const togglePlay = useCallback(() => {
    triggerHaptic("light");
    setIsPlaying((prev) => !prev);
  }, []);

  // 🔥 FIXED CLOSE HANDLER
  const handleClose = useCallback(() => {
    triggerHaptic("light");

    // Always go home safely
    router.replace("/(tabs)");
  }, [router]);

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <VerticalSwipeGesture onSwipeDown={handleClose}>
        <LinearGradient style={{ flex: 1 }} colors={gradientColors}>
          <View style={{ flex: 1 }}>
            
            {/* TOP BAR */}
            <View
              style={[
                styles.topBar,
                { top: top + 12 },
              ]}
            >
              <TouchableOpacity onPress={handleClose}>
                <Ionicons name="chevron-down" size={26} color="#fff" />
              </TouchableOpacity>

              <MaterialCommunityIcons name="dots-vertical" size={24} color="#fff" />
            </View>

            {/* CONTENT */}
            <View
              style={[
                styles.contentContainer,
                { marginTop: top + 60 },
              ]}
            >
              {/* ARTWORK */}
              <View style={styles.artworkContainer}>
                <Image
                  source={getImageSource(validatedTrack.artwork)}
                  style={styles.artworkImage}
                  contentFit="cover"
                  onError={() => setImageError(true)}
                />

                {!imageColors && artworkForColors && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
              </View>

              {/* INFO */}
              <View style={styles.infoContainer}>
                <MovingText
                  text={validatedTrack.title}
                  animationThreshold={28}
                  style={styles.title}
                />
                <Text style={styles.artist}>{validatedTrack.artist}</Text>
                {validatedTrack.album && (
                  <Text style={styles.album}>{validatedTrack.album}</Text>
                )}
              </View>

              {/* PROGRESS */}
              <View style={styles.progressContainer}>
                <PlayerProgressBar />
              </View>

              {/* CONTROLS */}
              <View style={styles.controls}>
                <Ionicons name="shuffle-outline" size={24} color="#fff" />
                <Ionicons name="play-skip-back" size={32} color="#fff" />

                <TouchableOpacity
                  onPress={togglePlay}
                  style={styles.playButton}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={40}
                    color="#fff"
                  />
                </TouchableOpacity>

                <Ionicons name="play-skip-forward" size={32} color="#fff" />
                <Ionicons name="repeat-outline" size={24} color="#fff" />
              </View>

              {/* BOTTOM ACTIONS */}
              <View style={styles.bottomActions}>
                <MaterialIcons name="queue-music" size={24} color="#fff" />
                <Ionicons name="heart-outline" size={24} color="#fff" />
                <Ionicons name="share-outline" size={24} color="#fff" />
              </View>
            </View>
          </View>
        </LinearGradient>
      </VerticalSwipeGesture>
    </>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    left: screenPadding.horizontal,
    right: screenPadding.horizontal,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1000,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: screenPadding.horizontal,
  },
  artworkContainer: {
    alignItems: "center",
    marginTop: verticalScale(20),
  },
  artworkImage: {
    width: SCREEN_WIDTH * 0.78,
    height: SCREEN_WIDTH * 0.78,
    borderRadius: 12,
  },
  loadingOverlay: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.78,
    height: SCREEN_WIDTH * 0.78,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
  },
  infoContainer: {
    marginTop: verticalScale(24),
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: moderateScale(20),
    fontWeight: "700",
    textAlign: "center",
  },
  artist: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  album: {
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  progressContainer: {
    marginTop: verticalScale(30),
  },
  controls: {
    marginTop: verticalScale(30),
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  playButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 40,
    padding: scale(8),
  },
  bottomActions: {
    marginTop: verticalScale(30),
    flexDirection: "row",
    justifyContent: "space-around",
  },
});
