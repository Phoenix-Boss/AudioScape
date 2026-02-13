/**
 * RELATED MODAL — CLIENT-ONLY VIEW
 * Pure client-side song recommendations
 * No analytics | No admin tools | No creator dashboards
 * Simple, fast, personalized recommendations
 */

import React, { useCallback, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ToastAndroid,
  Dimensions,
  StatusBar,
  Share,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import {
  Ionicons,
  MaterialIcons,
  MaterialCommunityIcons,
  Feather,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeInDown,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";

// ============================================================================
// LOCAL IMPORTS — Client Only
// ============================================================================
import { Colors } from "@/constants/Colors";
import { unknownTrackImageUri } from "@/constants/images";
import { triggerHaptic } from "@/helpers/haptics";
import { defaultStyles } from "@/styles";
import { moderateScale, verticalScale, scale } from "react-native-size-matters/extend";
import { ScaledSheet } from "react-native-size-matters/extend";

// ============================================================================
// MAVIN ENGINE CLIENT IMPORTS — No Analytics
// ============================================================================
import {
  useRecommendations,
  usePlayNext,
  useAddToQueue,
  useRadioStation,
  type Recommendation,
  type RecommendationType,
} from "@/services/mavin/recommendation/RecommendationEngine";
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { errorFromUnknown } from "@/services/mavin/core/errors";

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================
const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleContainer}>
      <MaterialCommunityIcons
        name={icon as any}
        size={moderateScale(18)}
        color={Colors.primary}
      />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  </View>
);

// ============================================================================
// RECOMMENDATION CARD COMPONENT — Client View
// ============================================================================
const RecommendationCard = ({
  item,
  index,
  onPress,
  onMenuPress,
  isPriority = false,
}: {
  item: Recommendation;
  index: number;
  onPress: (item: Recommendation) => void;
  onMenuPress: (item: Recommendation) => void;
  isPriority?: boolean;
}) => {
  // Simple color based on confidence
  const getConfidenceColor = (confidence: number) => {
    if (confidence > 0.8) return Colors.primary;
    if (confidence > 0.6) return "#4CAF50";
    return "#9C27B0";
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={[styles.recommendationCard, isPriority && styles.priorityCard]}
    >
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
      >
        {/* Artwork */}
        <View style={styles.artworkContainer}>
          <Image
            source={{ uri: item.artwork ?? unknownTrackImageUri }}
            style={styles.artwork}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.6)"]}
            style={styles.artworkGradient}
          />
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {item.artist}
          </Text>

          {/* Simple confidence indicator */}
          <View style={styles.confidenceContainer}>
            <View
              style={[
                styles.confidenceDot,
                { backgroundColor: getConfidenceColor(item.confidence) },
              ]}
            />
            <Text style={styles.confidenceText}>
              {Math.round(item.confidence * 100)}% match
            </Text>
          </View>
        </View>

        {/* Match badge */}
        <View style={styles.matchBadge}>
          <Text
            style={[
              styles.matchText,
              { color: getConfidenceColor(item.confidence) },
            ]}
          >
            {Math.round(item.confidence * 100)}%
          </Text>
        </View>
      </TouchableOpacity>

      {/* Menu button */}
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => onMenuPress(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MaterialCommunityIcons
          name="dots-vertical"
          size={moderateScale(18)}
          color="rgba(255,255,255,0.6)"
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ============================================================================
// RADIO CARD COMPONENT
// ============================================================================
const RadioCard = ({
  station,
  onPress,
}: {
  station: { name: string; description: string };
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={styles.radioCard}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <LinearGradient
      colors={[Colors.primary, "#AA8C30"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.radioGradient}
    >
      <MaterialIcons name="radio" size={moderateScale(28)} color="#000" />
    </LinearGradient>
    <View style={styles.radioInfo}>
      <Text style={styles.radioTitle} numberOfLines={1}>
        {station.name}
      </Text>
      <Text style={styles.radioSubtitle} numberOfLines={1}>
        {station.description}
      </Text>
    </View>
    <Feather name="play-circle" size={moderateScale(32)} color={Colors.primary} />
  </TouchableOpacity>
);

// ============================================================================
// CONTEXT MENU MODAL — Client Actions Only
// ============================================================================
const ContextMenu = ({
  visible,
  onClose,
  item,
  onPlayNow,
  onAddToQueue,
  onPlayNext,
  onAddToPlaylist,
  onShare,
}: {
  visible: boolean;
  onClose: () => void;
  item: Recommendation | null;
  onPlayNow: () => void;
  onAddToQueue: () => void;
  onPlayNext: () => void;
  onAddToPlaylist: () => void;
  onShare: () => void;
}) => {
  if (!visible || !item) return null;

  return (
    <View style={styles.contextMenuOverlay}>
      <TouchableOpacity
        style={styles.contextMenuBackdrop}
        onPress={onClose}
        activeOpacity={1}
      />
      <Animated.View
        entering={SlideInDown.springify()}
        exiting={SlideOutDown}
        style={styles.contextMenuContainer}
      >
        <BlurView intensity={90} tint="dark" style={styles.contextMenuBlur}>
          <View style={styles.contextMenuHeader}>
            <Image
              source={{ uri: item.artwork ?? unknownTrackImageUri }}
              style={styles.contextMenuArtwork}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.contextMenuHeaderText}>
              <Text style={styles.contextMenuTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.contextMenuArtist} numberOfLines={1}>
                {item.artist}
              </Text>
            </View>
          </View>

          <View style={styles.contextMenuDivider} />

          <TouchableOpacity style={styles.contextMenuItem} onPress={onPlayNow}>
            <Feather name="play" size={moderateScale(20)} color="#fff" />
            <Text style={styles.contextMenuItemText}>Play Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contextMenuItem} onPress={onPlayNext}>
            <MaterialIcons
              name="playlist-play"
              size={moderateScale(20)}
              color="#fff"
            />
            <Text style={styles.contextMenuItemText}>Play Next</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contextMenuItem} onPress={onAddToQueue}>
            <MaterialIcons
              name="queue-music"
              size={moderateScale(20)}
              color="#fff"
            />
            <Text style={styles.contextMenuItemText}>Add to Queue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contextMenuItem}
            onPress={onAddToPlaylist}
          >
            <MaterialIcons
              name="playlist-add"
              size={moderateScale(20)}
              color="#fff"
            />
            <Text style={styles.contextMenuItemText}>Add to Playlist</Text>
          </TouchableOpacity>

          <View style={styles.contextMenuDivider} />

          <TouchableOpacity style={styles.contextMenuItem} onPress={onShare}>
            <Feather name="share" size={moderateScale(20)} color="#fff" />
            <Text style={styles.contextMenuItemText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contextMenuCancel} onPress={onClose}>
            <Text style={styles.contextMenuCancelText}>Cancel</Text>
          </TouchableOpacity>
        </BlurView>
      </Animated.View>
    </View>
  );
};

// ============================================================================
// MAIN RELATED MODAL — CLIENT-ONLY
// No analytics | No admin | Pure recommendations
// ============================================================================
export default function RelatedModal() {
  const router = useRouter();
  const { id: songId } = useLocalSearchParams<{ id: string }>();
  const { top, bottom } = useSafeAreaInsets();
  const { isPremium } = useGracePeriod();

  const [selectedItem, setSelectedItem] = useState<Recommendation | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [recommendationType, setRecommendationType] =
    useState<RecommendationType>("personalized");
  const flatListRef = useRef<FlatList>(null);

  // ==========================================================================
  // ENGINE HOOKS — Client Only
  // ==========================================================================
  const {
    recommendations = [],
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error,
  } = useRecommendations({
    trackId: songId || "",
    type: recommendationType,
    limit: 20,
  });

  const { mutate: playNext } = usePlayNext();
  const { mutate: addToQueue } = useAddToQueue();
  const { mutate: createRadio } = useRadioStation();

  // ==========================================================================
  // HANDLERS — Client Actions Only
  // ==========================================================================
  const handlePlayNow = useCallback(
    async (item: Recommendation) => {
      try {
        triggerHaptic("light");

        // Simple play action — no analytics
        const track = {
          id: item.id,
          title: item.title,
          artist: item.artist,
          album: item.album,
          artwork: item.artwork,
          duration: item.duration,
          videoId: item.videoId,
        };

        // Dispatch play event
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("PLAYER_PLAY", {
              detail: { track },
            })
          );
        }

        ToastAndroid.show(`Playing: ${item.title}`, ToastAndroid.SHORT);
        router.back();
      } catch (error) {
        ToastAndroid.show("Failed to play song", ToastAndroid.SHORT);
      }
    },
    [router]
  );

  const handlePlayNext = useCallback((item: Recommendation) => {
    try {
      triggerHaptic("light");

      const track = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        album: item.album,
        artwork: item.artwork,
        duration: item.duration,
        videoId: item.videoId,
      };

      playNext(track);
      ToastAndroid.show("Song will play next", ToastAndroid.SHORT);
      setContextMenuVisible(false);
    } catch (error) {
      ToastAndroid.show("Failed to add to queue", ToastAndroid.SHORT);
    }
  }, [playNext]);

  const handleAddToQueue = useCallback(
    (item: Recommendation) => {
      try {
        triggerHaptic("light");

        const track = {
          id: item.id,
          title: item.title,
          artist: item.artist,
          album: item.album,
          artwork: item.artwork,
          duration: item.duration,
          videoId: item.videoId,
        };

        addToQueue(track);
        ToastAndroid.show("Added to queue", ToastAndroid.SHORT);
        setContextMenuVisible(false);
      } catch (error) {
        ToastAndroid.show("Failed to add to queue", ToastAndroid.SHORT);
      }
    },
    [addToQueue]
  );

  const handleStartRadio = useCallback(() => {
    try {
      triggerHaptic("light");

      createRadio({
        seed: songId || "",
        name: `Song Radio`,
      });

      ToastAndroid.show("Radio station created", ToastAndroid.SHORT);
      router.back();
    } catch (error) {
      ToastAndroid.show("Failed to create radio", ToastAndroid.SHORT);
    }
  }, [createRadio, songId, router]);

  const handleMenuPress = useCallback((item: Recommendation) => {
    triggerHaptic("light");
    setSelectedItem(item);
    setContextMenuVisible(true);
  }, []);

  const handleShare = useCallback(async (item: Recommendation) => {
    try {
      triggerHaptic("light");
      setContextMenuVisible(false);

      const shareUrl = item.videoId
        ? `https://music.youtube.com/watch?v=${item.videoId}`
        : `https://music.youtube.com/watch?v=${item.id}`;

      await Share.share({
        message: `${item.title} by ${item.artist}\n${shareUrl}`,
        title: item.title,
      });
    } catch (error) {
      // User cancelled share - ignore
    }
  }, []);

  const handleAddToPlaylist = useCallback(
    (item: Recommendation) => {
      triggerHaptic("light");
      setContextMenuVisible(false);

      const track = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        thumbnail: item.artwork,
      };

      router.push({
        pathname: "/(modals)/addToPlaylist",
        params: { track: JSON.stringify(track) },
      });
    },
    [router]
  );

  const handleRefresh = useCallback(() => {
    triggerHaptic("light");
    refetch();
  }, [refetch]);

  // ==========================================================================
  // FILTERED RECOMMENDATIONS
  // ==========================================================================
  const { priorityRecs, standardRecs } = useMemo(() => {
    if (!recommendations?.length)
      return { priorityRecs: [], standardRecs: [] };

    const priority = recommendations.filter((r) => r.confidence > 0.8);
    const standard = recommendations.filter((r) => r.confidence <= 0.8);

    return { priorityRecs: priority, standardRecs: standard };
  }, [recommendations]);

  // ==========================================================================
  // RENDER FUNCTIONS
  // ==========================================================================
  const renderHeader = useCallback(
    () => (
      <View style={styles.headerContainer}>
        {/* Radio Station Card */}
        <RadioCard
          station={{
            name: "Start Radio",
            description: "Endless music based on this song",
          }}
          onPress={handleStartRadio}
        />

        {/* Simple Type Tabs */}
        <View style={styles.typeTabs}>
          <TouchableOpacity
            style={[
              styles.typeTab,
              recommendationType === "personalized" && styles.typeTabActive,
            ]}
            onPress={() => setRecommendationType("personalized")}
          >
            <Text
              style={[
                styles.typeTabText,
                recommendationType === "personalized" &&
                  styles.typeTabTextActive,
              ]}
            >
              For You
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeTab,
              recommendationType === "similar_artist" && styles.typeTabActive,
            ]}
            onPress={() => setRecommendationType("similar_artist")}
          >
            <Text
              style={[
                styles.typeTabText,
                recommendationType === "similar_artist" &&
                  styles.typeTabTextActive,
              ]}
            >
              Similar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeTab,
              recommendationType === "trending" && styles.typeTabActive,
            ]}
            onPress={() => setRecommendationType("trending")}
          >
            <Text
              style={[
                styles.typeTabText,
                recommendationType === "trending" && styles.typeTabTextActive,
              ]}
            >
              Trending
            </Text>
          </TouchableOpacity>
        </View>

        {/* Priority Recommendations */}
        {priorityRecs.length > 0 && (
          <>
            <SectionHeader title="Top Picks" icon="star" />
            {priorityRecs.map((item, index) => (
              <RecommendationCard
                key={item.id}
                item={item}
                index={index}
                onPress={handlePlayNow}
                onMenuPress={handleMenuPress}
                isPriority
              />
            ))}
          </>
        )}
      </View>
    ),
    [
      recommendationType,
      priorityRecs,
      handlePlayNow,
      handleMenuPress,
      handleStartRadio,
    ]
  );

  const renderFooter = useCallback(() => {
    if (!hasNextPage) return null;

    return (
      <View style={styles.footerContainer}>
        {isFetchingNextPage ? (
          <ActivityIndicator color={Colors.primary} size="small" />
        ) : (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => fetchNextPage()}
          >
            <Text style={styles.loadMoreText}>Load More</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <MaterialCommunityIcons
          name="music-note-off"
          size={moderateScale(64)}
          color="rgba(255,255,255,0.2)"
        />
        <Text style={styles.emptyTitle}>No recommendations found</Text>
        <Text style={styles.emptyText}>Try a different category</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isLoading, handleRefresh]);

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================
  if (isLoading && !recommendations?.length) {
    return (
      <View style={[defaultStyles.container, styles.loadingContainer]}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Finding recommendations...</Text>
      </View>
    );
  }

  // ==========================================================================
  // ERROR STATE — Simple, User-Friendly
  // ==========================================================================
  if (error) {
    return (
      <View style={[defaultStyles.container, styles.errorContainer]}>
        <StatusBar
          barStyle="light-content"
          translucent
          backgroundColor="transparent"
        />
        <MaterialCommunityIcons
          name="alert-circle-outline"
          size={moderateScale(64)}
          color="rgba(255,255,255,0.3)"
        />
        <Text style={styles.errorTitle}>Unable to load recommendations</Text>
        <Text style={styles.errorText}>Please check your connection</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ==========================================================================
  // MAIN RENDER — Pure Client Interface
  // ==========================================================================
  return (
    <View style={[defaultStyles.container, styles.container]}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Simple Header */}
      <BlurView
        intensity={80}
        tint="dark"
        style={[styles.header, { paddingTop: top + verticalScale(8) }]}
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            triggerHaptic("light");
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-down" size={moderateScale(24)} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Recommended</Text>
        </View>

        <TouchableOpacity
          style={styles.headerAction}
          onPress={handleRefresh}
          disabled={isLoading}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isLoading ? "refresh-outline" : "refresh"}
            size={moderateScale(20)}
            color={isLoading ? "rgba(255,255,255,0.5)" : "#fff"}
          />
        </TouchableOpacity>
      </BlurView>

      {/* Recommendations List */}
      <FlatList
        ref={flatListRef}
        data={standardRecs}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <RecommendationCard
            item={item}
            index={index + (priorityRecs?.length || 0)}
            onPress={handlePlayNow}
            onMenuPress={handleMenuPress}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottom + verticalScale(20) },
        ]}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.3}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />

      {/* Context Menu */}
      <ContextMenu
        visible={contextMenuVisible}
        onClose={() => setContextMenuVisible(false)}
        item={selectedItem}
        onPlayNow={() => selectedItem && handlePlayNow(selectedItem)}
        onPlayNext={() => selectedItem && handlePlayNext(selectedItem)}
        onAddToQueue={() => selectedItem && handleAddToQueue(selectedItem)}
        onAddToPlaylist={() =>
          selectedItem && handleAddToPlaylist(selectedItem)
        }
        onShare={() => selectedItem && handleShare(selectedItem)}
      />
    </View>
  );
}

// ============================================================================
// CLIENT-ONLY STYLES — Clean, Simple, No Admin UI
// ============================================================================
const styles = ScaledSheet.create({
  container: {
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingText: {
    color: "#fff",
    fontSize: "16@ms",
    marginTop: "16@vs",
    opacity: 0.8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    paddingHorizontal: "40@s",
  },
  errorTitle: {
    color: "#fff",
    fontSize: "18@ms",
    fontWeight: "600",
    marginTop: "20@vs",
  },
  errorText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "14@ms",
    textAlign: "center",
    marginTop: "8@vs",
    marginBottom: "24@vs",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: "16@s",
    paddingBottom: "12@vs",
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  closeButton: {
    width: "40@s",
    height: "40@s",
    borderRadius: "20@s",
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: "16@ms",
    fontWeight: "600",
  },
  headerAction: {
    width: "40@s",
    height: "40@s",
    borderRadius: "20@s",
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingTop: "80@vs",
    paddingHorizontal: "16@s",
  },
  headerContainer: {
    marginBottom: "8@vs",
  },
  sectionHeader: {
    marginTop: "20@vs",
    marginBottom: "12@vs",
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: "8@s",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: "15@ms",
    fontWeight: "600",
  },
  radioCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(212,175,55,0.1)",
    borderRadius: "12@ms",
    padding: "12@s",
    marginBottom: "16@vs",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
  },
  radioGradient: {
    width: "52@ms",
    height: "52@ms",
    borderRadius: "26@ms",
    justifyContent: "center",
    alignItems: "center",
  },
  radioInfo: {
    flex: 1,
    marginLeft: "12@s",
  },
  radioTitle: {
    color: "#fff",
    fontSize: "15@ms",
    fontWeight: "600",
    marginBottom: "2@vs",
  },
  radioSubtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "12@ms",
  },
  typeTabs: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: "20@ms",
    padding: "4@s",
    marginBottom: "8@vs",
  },
  typeTab: {
    flex: 1,
    paddingVertical: "8@vs",
    alignItems: "center",
    borderRadius: "16@ms",
  },
  typeTabActive: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  typeTabText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "12@ms",
    fontWeight: "500",
  },
  typeTabTextActive: {
    color: "#fff",
  },
  recommendationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: "12@ms",
    marginBottom: "8@vs",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
  priorityCard: {
    backgroundColor: "rgba(212,175,55,0.08)",
    borderColor: "rgba(212,175,55,0.3)",
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: "12@s",
  },
  artworkContainer: {
    position: "relative",
    width: "50@ms",
    height: "50@ms",
    borderRadius: "8@ms",
    overflow: "hidden",
  },
  artwork: {
    width: "100%",
    height: "100%",
  },
  artworkGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "20@ms",
  },
  trackInfo: {
    flex: 1,
    marginLeft: "12@s",
  },
  trackTitle: {
    color: "#fff",
    fontSize: "14@ms",
    fontWeight: "500",
    marginBottom: "2@vs",
  },
  trackArtist: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "12@ms",
    marginBottom: "4@vs",
  },
  confidenceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: "4@s",
  },
  confidenceDot: {
    width: "6@s",
    height: "6@s",
    borderRadius: "3@s",
  },
  confidenceText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "10@ms",
  },
  matchBadge: {
    alignItems: "center",
    marginRight: "8@s",
  },
  matchText: {
    fontSize: "15@ms",
    fontWeight: "700",
  },
  menuButton: {
    padding: "12@s",
  },
  footerContainer: {
    paddingVertical: "20@vs",
    alignItems: "center",
  },
  loadMoreButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: "8@vs",
    paddingHorizontal: "20@s",
    borderRadius: "16@ms",
  },
  loadMoreText: {
    color: "#fff",
    fontSize: "13@ms",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: "60@vs",
    paddingHorizontal: "40@s",
  },
  emptyTitle: {
    color: "#fff",
    fontSize: "16@ms",
    fontWeight: "600",
    marginTop: "16@vs",
  },
  emptyText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "13@ms",
    textAlign: "center",
    marginTop: "8@vs",
    marginBottom: "24@vs",
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: "10@vs",
    paddingHorizontal: "28@s",
    borderRadius: "20@ms",
  },
  retryButtonText: {
    color: "#000",
    fontSize: "13@ms",
    fontWeight: "600",
  },
  closeButton: {
    marginTop: "12@vs",
    paddingVertical: "10@vs",
    paddingHorizontal: "28@s",
  },
  closeButtonText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: "13@ms",
  },
  contextMenuOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
  },
  contextMenuBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  contextMenuContainer: {
    borderTopLeftRadius: "20@ms",
    borderTopRightRadius: "20@ms",
    overflow: "hidden",
  },
  contextMenuBlur: {
    padding: "20@s",
    paddingBottom: "32@vs",
  },
  contextMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: "16@vs",
  },
  contextMenuArtwork: {
    width: "48@ms",
    height: "48@ms",
    borderRadius: "8@ms",
    marginRight: "12@s",
  },
  contextMenuHeaderText: {
    flex: 1,
  },
  contextMenuTitle: {
    color: "#fff",
    fontSize: "15@ms",
    fontWeight: "600",
    marginBottom: "2@vs",
  },
  contextMenuArtist: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "13@ms",
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginVertical: "12@vs",
  },
  contextMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: "12@vs",
    gap: "12@s",
  },
  contextMenuItemText: {
    color: "#fff",
    fontSize: "14@ms",
  },
  contextMenuCancel: {
    marginTop: "12@vs",
    paddingVertical: "12@vs",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: "12@ms",
    alignItems: "center",
  },
  contextMenuCancelText: {
    color: Colors.primary,
    fontSize: "14@ms",
    fontWeight: "600",
  },
});