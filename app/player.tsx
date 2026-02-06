/**
 * This file defines the main full-screen music player of the application.
 * Displays the currently active track with artwork, title, artist, controls,
 * progress, favorite/download/share, and navigation to queue/lyrics.
 * Follows premium behavior: no mini-player here (global one lives in tabs layout).
 */
import { MovingText } from "@/components/MovingText";
import VerticalSwipeGesture from "@/components/navigation/VerticalGesture";
import {
  DownloadSongButton,
  PlayerControls,
} from "@/components/PlayerControls";
import HeartButton from "@/components/HeartButton";
import { PlayerProgressBar } from "@/components/PlayerProgressbar";
import { Colors } from "@/constants/Colors";
import { screenPadding } from "@/constants/tokens";
import { triggerHaptic } from "@/helpers/haptics";
import { useImageColors } from "@/hooks/useImageColors";
import { useTrackPlayerFavorite } from "@/hooks/useTrackPlayerFavorite";
import { defaultStyles } from "@/styles";
import { Image } from "expo-image"; // ← Changed to expo-image
import {
  MaterialIcons,
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  Share,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  moderateScale,
  scale,
  ScaledSheet,
  verticalScale,
} from "react-native-size-matters/extend";
import { useActiveTrack } from "react-native-track-player";
import { unknownTrackImageUri } from "@/constants/images";

/**
 * `PlayerScreen` – Full-screen music player UI
 */
const PlayerScreen = () => {
  const activeTrack = useActiveTrack();
  const router = useRouter();

  // Extract dominant colors from artwork for gradient background
  const { imageColors } = useImageColors(
    activeTrack?.artwork ?? unknownTrackImageUri
  );

  const { top, bottom } = useSafeAreaInsets();

  const { isFavorite, toggleFavoriteFunc } = useTrackPlayerFavorite();

  const onShare = async () => {
    triggerHaptic();
    try {
      await Share.share({
        message: `https://music.youtube.com/watch?v=${activeTrack?.id}`,
        title: "Check out this song!",
      });
    } catch (error: any) {
      console.error("Share failed:", error.message);
    }
  };

  // Loading state when no track is active
  if (!activeTrack) {
    return (
      <View style={[defaultStyles.container, { justifyContent: "center" }]}>
        <ActivityIndicator color={Colors.icon} size="large" />
      </View>
    );
  }

  return (
    // Swipe down to dismiss (uses your VerticalSwipeGesture)
    <VerticalSwipeGesture>
      {/* Dynamic gradient background based on artwork */}
      <LinearGradient
        style={{ flex: 1 }}
        colors={
          imageColors
            ? [imageColors.dominant, "#000"]
            : [Colors.background, "#000"]
        }
      >
        <View style={styles.overlayContainer}>
          {/* Subtle dismiss indicator at top */}
          <DismissPlayerSymbol />

          <View style={{ flex: 1, marginTop: top + verticalScale(60) }}>
            {/* Large centered artwork – now using expo-image */}
            <View style={styles.artworkImageContainer}>
              <Image
                source={activeTrack.artwork ?? unknownTrackImageUri}
                style={styles.artworkImage}
                contentFit="cover"           // equivalent to resizeMode="cover"
                transition={300}             // smooth fade-in transition
                placeholder={require("@/assets/images/mavins.png")} // optional: add a local blur placeholder
                cachePolicy="memory-disk"    // aggressive caching
              />
            </View>

            {/* Track info + controls */}
            <View style={{ flex: 1, marginTop: verticalScale(48) }}>
              <View style={{ marginHorizontal: screenPadding.horizontal }}>
                {/* Title, favorite, download, share row */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <View style={styles.trackTitleContainer}>
                    <MovingText
                      text={activeTrack.title ?? "Unknown Title"}
                      animationThreshold={28}
                      style={styles.trackTitleText}
                    />
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: scale(8) }}>
                    <View style={styles.favoriteButton}>
                      <HeartButton
                        isFavorite={isFavorite}
                        onToggle={() => {
                          triggerHaptic();
                          toggleFavoriteFunc();
                        }}
                        size={moderateScale(22)}
                      />
                    </View>

                    <DownloadSongButton style={styles.downloadButton} />

                    <TouchableOpacity
                      onPress={onShare}
                      style={styles.shareButton}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <MaterialCommunityIcons
                        name="share-outline"
                        size={moderateScale(26)}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Artist name */}
                {activeTrack.artist && (
                  <Text
                    numberOfLines={1}
                    style={[styles.trackArtistText, { marginTop: verticalScale(8) }]}
                  >
                    {activeTrack.artist}
                  </Text>
                )}

                {/* Progress bar */}
                <PlayerProgressBar style={{ marginTop: verticalScale(40) }} />

                {/* Main playback controls */}
                <PlayerControls
                  style={{
                    marginTop: verticalScale(48),
                    marginBottom: verticalScale(100),
                  }}
                />
              </View>

              {/* Bottom action buttons (Queue / Lyrics) */}
              <View
                style={[
                  styles.bottomActions,
                  { paddingBottom: bottom + verticalScale(24) },
                ]}
              >
                <TouchableOpacity
                  style={styles.bottomButton}
                  onPress={() => {
                    triggerHaptic();
                    router.push({ pathname: "/(modals)/queue" });
                  }}
                >
                  <MaterialIcons
                    name="queue-music"
                    size={moderateScale(22)}
                    color={Colors.text}
                  />
                  <Text style={styles.bottomButtonText}>Queue</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bottomButton}
                  onPress={() => {
                    triggerHaptic();
                    router.push({ pathname: "/(modals)/lyrics" });
                  }}
                >
                  <Feather
                    name="align-center"
                    size={moderateScale(22)}
                    color={Colors.text}
                  />
                  <Text style={styles.bottomButtonText}>Lyrics</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </VerticalSwipeGesture>
  );
};

/**
 * Dismiss indicator – small elegant bar at top
 */
const DismissPlayerSymbol = () => {
  const { top } = useSafeAreaInsets();

  return (
    <View
      style={{
        position: "absolute",
        top: top + 12,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <View
        style={{
          width: scale(48),
          height: verticalScale(5),
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.65)",
        }}
      />
    </View>
  );
};

// Styles – refined for premium feel (unchanged)
const styles = ScaledSheet.create({
  overlayContainer: {
    ...defaultStyles.container,
    paddingHorizontal: screenPadding.horizontal,
    backgroundColor: "rgba(0,0,0,0.35)", // Slightly darker overlay for contrast
  },
  artworkImageContainer: {
    elevation: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    borderRadius: "16@ms",
    width: "320@ms",
    height: "320@ms",
    alignSelf: "center",
    overflow: "hidden",
  },
  artworkImage: {
    width: "100%",
    height: "100%",
    borderRadius: "16@ms",
  },
  trackTitleContainer: {
    flex: 1,
    overflow: "hidden",
    marginRight: scale(12),
  },
  trackTitleText: {
    ...defaultStyles.text,
    fontSize: "24@ms",
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  trackArtistText: {
    ...defaultStyles.text,
    fontSize: "18@ms",
    opacity: 0.85,
    letterSpacing: -0.2,
  },
  favoriteButton: {
    width: "36@ms",
    height: "36@ms",
    borderRadius: "12@ms",
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  downloadButton: {
    width: "36@ms",
    height: "36@ms",
    borderRadius: "12@ms",
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  shareButton: {
    width: "36@ms",
    height: "36@ms",
    borderRadius: "12@ms",
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: screenPadding.horizontal,
  },
  bottomButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: "10@vs",
    paddingHorizontal: "18@s",
    borderRadius: "24@ms",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  bottomButtonText: {
    color: "#fff",
    fontSize: "15@ms",
    fontWeight: "600",
    marginLeft: "8@s",
  },
});

export default PlayerScreen;