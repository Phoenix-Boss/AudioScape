// app/(player)/index.tsx
import { MovingText } from "@/components/MovingText";
import VerticalSwipeGesture from "@/components/navigation/VerticalGesture";
import { PlayerProgressBar } from "@/components/PlayerProgressbar";
import { Colors } from "@/constants/Colors";
import { screenPadding } from "@/constants/tokens";
import { triggerHaptic } from "@/helpers/haptics";
import { useImageColors } from "@/hooks/useImageColors";
import { defaultStyles } from "@/styles";
import { Image } from "expo-image";
import {
  MaterialIcons,
  Feather,
  Ionicons,
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
  StatusBar,
  StyleSheet,
  Platform,
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

// ============================================================================
// MAVIN ENGINE INTEGRATIONS (TanStack Query + Zod)
// ============================================================================
import { useMavinEngine } from "@/services/mavin/engine/Engine";
import {
  useEngagementMetrics,
  useLikeSong,
  useComments,
} from "@/services/engagement/EngagementEngine";
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { useAdMonetization } from "@/services/mavin/monetization/AdMonetization";
import { AudioEngine } from "@/services/mavin/player/AudioEngine";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";

// ============================================================================
// ZOD VALIDATION (Type Safety)
// ============================================================================
const PlayerTrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().optional(),
  artwork: z.string().url().or(z.string().startsWith("file://")).optional(),
  duration: z.number().int().positive(),
  videoId: z.string().min(10),
  genre: z.string().optional(),
});

type PlayerTrack = z.infer<typeof PlayerTrackSchema>;

// ============================================================================
// REUSABLE HOOKS (Lightweight Abstractions)
// ============================================================================
const usePlayerActions = (trackId: string, videoId: string) => {
  const { likeSong } = useLikeSong();
  const { shareSong } = useShareSong(); // Assume implemented similarly to likeSong
  const router = useRouter();

  const handleLike = useCallback(() => {
    triggerHaptic("light");
    likeSong.mutate(trackId);
  }, [trackId, likeSong]);

  const handleShare = useCallback(async () => {
    triggerHaptic("light");
    try {
      const shareUrl = `https://music.youtube.com/watch?v=${videoId}`;
      await Share.share({
        message: `Check out "${title}" by ${artist} ${shareUrl}`,
        title: title ?? "Check out this song!",
      });
      shareSong.mutate(trackId); // Record share in engagement engine
    } catch (error) {
      logError(errorFromUnknown(error), "warn");
    }
  }, [trackId, videoId, title, artist, shareSong]);

  const openComments = useCallback(() => {
    triggerHaptic("light");
    router.push("/(modals)/comments");
  }, [router]);

  return { handleLike, handleShare, openComments };
};

const usePlaybackControls = () => {
  const { play, pause, next, prev, seek, isPlaying } = useMavinEngine();

  const togglePlay = useCallback(() => {
    triggerHaptic("light");
    isPlaying ? pause() : play();
  }, [isPlaying, play, pause]);

  const handleNext = useCallback(() => {
    triggerHaptic("light");
    next();
  }, [next]);

  const handlePrev = useCallback(() => {
    triggerHaptic("light");
    prev();
  }, [prev]);

  const handleSeek = useCallback(
    (position: number) => {
      triggerHaptic("light");
      seek(position);
    },
    [seek],
  );

  return { togglePlay, handleNext, handlePrev, handleSeek, isPlaying };
};

// ============================================================================
// PLAYER SCREEN (Engine Integration Only - Zero UI Changes)
// ============================================================================
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const GOLD_COLORS = {
  primary: "#D4AF37",
  shiny: "#FFD700",
  muted: "rgba(212, 175, 55, 0.3)",
};

const PlayerScreen = () => {
  // ============================================================================
  // ENGINE HOOKS (TanStack Query Powered)
  // ============================================================================
  const engine = useMavinEngine();
  const { currentTrack, isPlaying, playbackPosition, playbackDuration } =
    engine;
  const { gracePeriodStatus, isPremium, daysRemaining } = useGracePeriod();
  const { shouldShowAds, startAd, skipAdForPremium } = useAdMonetization();
  const { metrics, isLoading: metricsLoading } = useEngagementMetrics(
    currentTrack?.id || "",
  );
  const { mutate: likeSong } = useLikeSong();
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const lastTapTime = useRef(0);
  const [activeTab, setActiveTab] = useState<"up-next" | "lyrics" | "related">(
    "up-next",
  );
  const [showFavoriteFeedback, setShowFavoriteFeedback] = useState(false);
  const [playerMode, setPlayerMode] = useState<"song" | "video">("song");

  // ============================================================================
  // VALIDATED TRACK DATA (Zod Safety)
  // ============================================================================
  const validatedTrack = useMemo(() => {
    if (!currentTrack) return null;
    try {
      return PlayerTrackSchema.parse(currentTrack);
    } catch (error) {
      logError(errorFromUnknown(error), "error");
      return null;
    }
  }, [currentTrack]);

  // ============================================================================
  // REUSABLE ACTION HOOKS
  // ============================================================================
  const { handleLike, handleShare, openComments } = usePlayerActions(
    validatedTrack?.id || "",
    validatedTrack?.videoId || "",
  );

  const { togglePlay, handleNext, handlePrev, handleSeek } =
    usePlaybackControls();

  // ============================================================================
  // ARTWORK & COLORS
  // ============================================================================
  const trackArtwork =
    validatedTrack?.artwork || require("@/assets/images/mavins.png");
  const { imageColors } = useImageColors(trackArtwork);

  // ============================================================================
  // COMMENT AD GATING (Ethical Monetization)
  // ============================================================================
  const handleCommentAccess = useCallback(async () => {
    // Premium users: Instant access
    if (isPremium) {
      skipAdForPremium("comment_unlock", validatedTrack?.id);
      openComments();
      return;
    }

    // Grace period: Instant access (no ads)
    if (gracePeriodStatus === "grace_period") {
      openComments();
      return;
    }

    // Free users: Show ad before comments
    const adCompleted = await startAd(
      "comment_unlock",
      "admob",
      "ca-app-pub-3940256099942544/1033173712", // Test ad unit
      validatedTrack?.id,
    );

    if (adCompleted) {
      openComments();
    }
  }, [
    isPremium,
    gracePeriodStatus,
    startAd,
    skipAdForPremium,
    openComments,
    validatedTrack,
  ]);

  // ============================================================================
  // DOUBLE-TAP FAVORITE (Frictionless Engagement)
  // ============================================================================
  const handleArtworkPress = useCallback(() => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (now - lastTapTime.current < DOUBLE_PRESS_DELAY) {
      triggerHaptic("medium");
      if (validatedTrack) {
        likeSong(validatedTrack.id);
        setShowFavoriteFeedback(true);
        setTimeout(() => setShowFavoriteFeedback(false), 1000);
      }
    }

    lastTapTime.current = now;
  }, [validatedTrack, likeSong]);

  // ============================================================================
  // LOADING STATE (Engine Validation)
  // ============================================================================
  if (!validatedTrack || !currentTrack) {
    return (
      <View
        style={[
          defaultStyles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={{ color: Colors.text, marginTop: 20, fontSize: 16 }}>
          {engine.status === "loading"
            ? "Loading track..."
            : "No track playing"}
        </Text>
        <TouchableOpacity
          style={{
            marginTop: 20,
            paddingHorizontal: 20,
            paddingVertical: 10,
            backgroundColor: Colors.primary,
            borderRadius: 8,
          }}
          onPress={() => router.back()}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ============================================================================
  // ACTION BUTTON COMPONENT (Reusable)
  // ============================================================================
  const ActionButton = ({
    icon,
    label,
    lib = "MaterialCommunityIcons",
    onPress,
    count,
  }: {
    icon: string;
    label: string;
    lib?: "Ionicons" | "MaterialCommunityIcons" | "MaterialIcons";
    onPress: () => void;
    count?: number | string;
  }) => {
    const IconLib: any =
      lib === "Ionicons"
        ? Ionicons
        : lib === "MaterialIcons"
          ? MaterialIcons
          : MaterialCommunityIcons;

    return (
      <TouchableOpacity style={styles.actionBtn} onPress={onPress}>
        <IconLib name={icon} size={moderateScale(22)} color="#fff" />
        <Text style={styles.actionText}>{count ? `${count}` : label}</Text>
      </TouchableOpacity>
    );
  };

  // ============================================================================
  // RENDER (Zero UI Changes - Pure Engine Integration)
  // ============================================================================
  return (
    <>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <VerticalSwipeGesture
        onSwipeDown={() => {
          triggerHaptic("light");
          router.back();
        }}
      >
        <LinearGradient
          style={styles.gradientBackground}
          colors={
            imageColors
              ? [imageColors.dominant, "#000", "#000"]
              : ["#1a0f05", "#0b0b0b", "#050505"]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <View style={styles.overlayContainer}>
            {/* TOP BAR */}
            <View style={[styles.topBar, { top: top + verticalScale(12) }]}>
              <TouchableOpacity
                style={styles.topButton}
                onPress={() => {
                  triggerHaptic("light");
                  router.back();
                }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons
                  name="chevron-down"
                  size={moderateScale(26)}
                  color="#fff"
                />
              </TouchableOpacity>

              <View style={styles.modeToggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    playerMode === "song" && styles.modeButtonActive,
                  ]}
                  onPress={() => {
                    triggerHaptic("light");
                    setPlayerMode("song");
                  }}
                >
                  <Text
                    style={[
                      styles.modeText,
                      playerMode === "song" && styles.modeTextActive,
                    ]}
                  >
                    Song
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeButton,
                    playerMode === "video" && styles.modeButtonActive,
                  ]}
                  onPress={() => {
                    triggerHaptic("light");
                    setPlayerMode("video");
                  }}
                >
                  <Text
                    style={[
                      styles.modeText,
                      playerMode === "video" && styles.modeTextActive,
                    ]}
                  >
                    Video
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.topRightIcons}>
                <TouchableOpacity
                  style={styles.topButton}
                  onPress={() => {
                    triggerHaptic("light");
                    router.push("/(modals)/equalizer");
                  }}
                >
                  <MaterialIcons
                    name="equalizer"
                    size={moderateScale(22)}
                    color="#fff"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.topButton}
                  onPress={() => {
                    triggerHaptic("light");
                    router.push("/(modals)/menu");
                  }}
                >
                  <MaterialIcons
                    name="more-vert"
                    size={moderateScale(22)}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flex: 1, marginTop: top + verticalScale(60) }}>
              {/* Artwork */}
              <TouchableOpacity
                style={styles.artworkContainer}
                onPress={handleArtworkPress}
                activeOpacity={0.9}
              >
                <View style={styles.shadowContainer}>
                  <View style={styles.artworkImageContainer}>
                    <Image
                      source={trackArtwork}
                      style={styles.artworkImage}
                      contentFit="cover"
                      transition={300}
                      placeholder={require("@/assets/images/mavins.png")}
                      cachePolicy="memory-disk"
                    />

                    {!isPlaying && (
                      <View style={styles.pausedOverlay}>
                        <MaterialIcons
                          name="pause"
                          size={moderateScale(48)}
                          color="#fff"
                        />
                      </View>
                    )}
                  </View>
                </View>

                {showFavoriteFeedback && (
                  <View style={styles.favoriteFeedback}>
                    <MaterialIcons
                      name="favorite"
                      size={moderateScale(48)}
                      color="#FF4081"
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* Track Info */}
              <View style={styles.infoContainer}>
                <View style={styles.info}>
                  <MovingText
                    text={validatedTrack.title}
                    animationThreshold={28}
                    style={styles.title}
                  />

                  <Text numberOfLines={1} style={styles.artist}>
                    {validatedTrack.artist}
                  </Text>

                  <Text style={styles.album} numberOfLines={1}>
                    {validatedTrack.album || "Single"}
                  </Text>
                </View>

                {/* Action Row - WITH ENGINE METRICS */}
                <View style={styles.actionsRow}>
                  <ActionButton
                    icon="thumb-up-outline"
                    label="Like"
                    lib="MaterialCommunityIcons"
                    onPress={handleLike}
                    count={metrics?.appLikeCount.toLocaleString() || "0"}
                  />

                  <ActionButton
                    icon="thumb-down-outline"
                    label=" "
                    lib="MaterialCommunityIcons"
                    onPress={() => {
                      triggerHaptic("light");
                      // Thumbs down functionality
                    }}
                  />

                  <ActionButton
                    icon="comment-outline"
                    label="Comment"
                    lib="MaterialCommunityIcons"
                    onPress={handleCommentAccess}
                    count={metrics?.appCommentCount.toLocaleString() || "0"}
                  />

                  <ActionButton
                    icon="playlist-plus"
                    label="Save"
                    lib="MaterialCommunityIcons"
                    onPress={() => {
                      triggerHaptic("light");
                      router.push("/(modals)/addToPlaylist");
                    }}
                  />

                  <ActionButton
                    icon="share-outline"
                    label="Share"
                    lib="Ionicons"
                    onPress={handleShare}
                    count={metrics?.appShareCount.toLocaleString() || "0"}
                  />
                </View>
              </View>

              {/* Progress bar - CONNECTED TO ENGINE */}
              <View style={styles.progressWrap}>
                <PlayerProgressBar
                  style={styles.progressBar}
                  position={playbackPosition}
                  duration={playbackDuration}
                  onSeek={handleSeek}
                />
              </View>

              {/* Transport Controls - ENGINE INTEGRATED */}
              <View style={[styles.controls, { marginTop: verticalScale(28) }]}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => {
                    triggerHaptic("light");
                    // Shuffle logic
                  }}
                >
                  <Ionicons
                    name="shuffle"
                    size={moderateScale(22)}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handlePrev}
                >
                  <Ionicons
                    name="play-skip-back"
                    size={moderateScale(32)}
                    color="#fff"
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.playBtn} onPress={togglePlay}>
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={moderateScale(34)}
                    color="#000"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handleNext}
                >
                  <Ionicons
                    name="play-skip-forward"
                    size={moderateScale(32)}
                    color="#fff"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => {
                    triggerHaptic("light");
                    // Repeat logic
                  }}
                >
                  <Ionicons
                    name="repeat"
                    size={moderateScale(22)}
                    color="rgba(255,255,255,0.7)"
                  />
                </TouchableOpacity>
              </View>

              {/* Bottom Tabs - ENGINE AWARE */}
              <View style={styles.bottomTabsContainer}>
                <View style={styles.viewToggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.viewToggleButton,
                      activeTab === "up-next" && styles.viewToggleButtonActive,
                    ]}
                    onPress={() => {
                      triggerHaptic("light");
                      setActiveTab("up-next");
                      router.push("/(modals)/queue");
                    }}
                  >
                    <Text
                      style={[
                        styles.viewToggleText,
                        activeTab === "up-next" && styles.viewToggleTextActive,
                      ]}
                    >
                      UP NEXT
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.toggleDivider} />

                  <TouchableOpacity
                    style={[
                      styles.viewToggleButton,
                      activeTab === "lyrics" && styles.viewToggleButtonActive,
                    ]}
                    onPress={() => {
                      triggerHaptic("light");
                      setActiveTab("lyrics");
                      router.push("/(modals)/lyrics");
                    }}
                  >
                    <Text
                      style={[
                        styles.viewToggleText,
                        activeTab === "lyrics" && styles.viewToggleTextActive,
                      ]}
                    >
                      LYRICS
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.toggleDivider} />

                  <TouchableOpacity
                    style={[
                      styles.viewToggleButton,
                      activeTab === "related" && styles.viewToggleButtonActive,
                    ]}
                    onPress={() => {
                      triggerHaptic("light");
                      setActiveTab("related");
                      router.push("/(modals)/related");
                    }}
                  >
                    <Text
                      style={[
                        styles.viewToggleText,
                        activeTab === "related" && styles.viewToggleTextActive,
                      ]}
                    >
                      RELATED
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      </VerticalSwipeGesture>
    </>
  );
};

// ============================================================================
// STYLES (UNCHANGED - Pure UI Preservation)
// ============================================================================
const styles = StyleSheet.create({
  gradientBackground: { flex: 1 },
  overlayContainer: {
    flex: 1,
    paddingHorizontal: screenPadding.horizontal,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  topBar: {
    position: "absolute",
    left: screenPadding.horizontal,
    right: screenPadding.horizontal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 1000,
  },
  topButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modeToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: scale(20),
    padding: scale(2),
  },
  modeButton: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: scale(16),
  },
  modeButtonActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  modeText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  modeTextActive: { color: "#fff" },
  topRightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  artworkContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginTop: verticalScale(20),
  },
  shadowContainer: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.8,
        shadowRadius: 30,
      },
      android: {
        elevation: 30,
        shadowColor: "#000",
      },
    }),
  },
  artworkImageContainer: {
    width: SCREEN_WIDTH * 0.78,
    height: SCREEN_WIDTH * 0.78,
    borderRadius: scale(12),
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  artworkImage: { width: "100%", height: "100%" },
  favoriteFeedback: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  pausedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  infoContainer: { marginTop: verticalScale(24) },
  info: { alignItems: "center" },
  title: {
    color: "#fff",
    fontSize: moderateScale(20),
    fontWeight: "700",
    textAlign: "center",
  },
  artist: {
    color: "rgba(255,255,255,0.7)",
    fontSize: moderateScale(14),
    marginTop: verticalScale(4),
    textAlign: "center",
  },
  album: {
    color: "rgba(255,255,255,0.5)",
    fontSize: moderateScale(12),
    marginTop: verticalScale(2),
    textAlign: "center",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: verticalScale(24),
    paddingHorizontal: scale(10),
  },
  actionBtn: { alignItems: "center", gap: verticalScale(6) },
  actionText: { color: "rgba(255,255,255,0.7)", fontSize: moderateScale(11) },
  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: verticalScale(22),
  },
  progressBar: { flex: 1 },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  controlButton: { padding: scale(8) },
  playBtn: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomTabsContainer: {
    marginTop: verticalScale(28),
    paddingBottom: verticalScale(20),
  },
  viewToggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: scale(20),
    padding: scale(4),
  },
  viewToggleButton: {
    paddingHorizontal: scale(16),
    paddingVertical: verticalScale(8),
    borderRadius: scale(16),
    flex: 1,
    alignItems: "center",
  },
  viewToggleButtonActive: { backgroundColor: "rgba(255,255,255,0.15)" },
  viewToggleText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: moderateScale(11),
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  viewToggleTextActive: { color: "#fff", fontWeight: "600" },
  toggleDivider: {
    width: 1,
    height: "70%",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
});

export default PlayerScreen;
