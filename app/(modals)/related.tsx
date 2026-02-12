/**
 * RELATED MODAL
 * Mavin Engine Integration - TanStack Query + Zod Validation
 * Displays personalized song recommendations based on current track
 * Features: Infinite scroll, play now, add to queue, context menu
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ToastAndroid,
  Dimensions,
  StatusBar,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "@d11/react-native-fast-image";
import { 
  Ionicons, 
  MaterialIcons, 
  MaterialCommunityIcons,
  Feather 
} from "@expo/vector-icons";
import { z } from "zod";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { 
  FadeInDown, 
  FadeOutUp,
  SlideInDown,
  SlideOutDown 
} from "react-native-reanimated";

import { Colors } from "@/constants/Colors";
import { unknownTrackImageUri } from "@/constants/images";
import { triggerHaptic } from "@/helpers/haptics";
import { defaultStyles } from "@/styles";
import { moderateScale, verticalScale, scale } from "react-native-size-matters/extend";
import { ScaledSheet } from "react-native-size-matters/extend";

// ============================================================================
// MAVIN ENGINE INTEGRATIONS
// ============================================================================
import { 
  useRecommendations,
  usePlayNext,
  useAddToQueue,
  useRadioStation,
  type Recommendation,
  type RecommendationType
} from "@/services/mavin/recommendation/RecommendationEngine";
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { useAdMonetization } from "@/services/mavin/monetization/AdMonetization";
import { usePlayback } from "@/services/mavin/player/PlaybackEngine";
import { useRecentlyPlayed } from "@/services/mavin/analytics/UserBehaviorEngine";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";
import { useMavinEngine } from "@/services/mavin/core/Engine";

// ============================================================================
// ZOD VALIDATION
// ============================================================================
const TrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().optional(),
  artwork: z.string().url().or(z.string().startsWith("file://")).optional(),
  duration: z.number().int().positive().optional(),
  videoId: z.string().optional(),
});

type Track = z.infer<typeof TrackSchema>;

// ============================================================================
// SECTION HEADER COMPONENT
// ============================================================================
const SectionHeader = ({ title, icon, onViewAll }: { 
  title: string; 
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onViewAll?: () => void;
}) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionTitleContainer}>
      <MaterialCommunityIcons name={icon} size={moderateScale(20)} color={Colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {onViewAll && (
      <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.viewAllText}>View All</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ============================================================================
// RECOMMENDATION CARD COMPONENT
// ============================================================================
const RecommendationCard = ({ 
  item, 
  index,
  onPress,
  onMenuPress,
  isPriority = false 
}: { 
  item: Recommendation; 
  index: number;
  onPress: (item: Recommendation) => void;
  onMenuPress: (item: Recommendation) => void;
  isPriority?: boolean;
}) => {
  const getReasonBadge = (reason: Recommendation['reason']) => {
    switch(reason) {
      case 'similar_artist': return { text: 'Similar Artist', icon: 'account-music', color: '#9C27B0' };
      case 'genre_match': return { text: 'Genre Match', icon: 'tag', color: '#2196F3' };
      case 'trending': return { text: 'Trending', icon: 'fire', color: '#FF9800' };
      case 'recently_played': return { text: 'Played Recently', icon: 'history', color: '#4CAF50' };
      case 'featured': return { text: 'Featured', icon: 'star', color: '#FFC107' };
      case 'personalized': return { text: 'For You', icon: 'heart', color: '#E91E63' };
      default: return { text: 'Recommended', icon: 'thumb-up', color: '#757575' };
    }
  };

  const badge = getReasonBadge(item.reason);

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify()}
      style={[
        styles.recommendationCard,
        isPriority && styles.priorityCard
      ]}
    >
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
      >
        {/* Artwork */}
        <View style={styles.artworkContainer}>
          <FastImage
            source={{ uri: item.artwork ?? unknownTrackImageUri }}
            style={styles.artwork}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.artworkGradient}
          />
          
          {/* Confidence score indicator */}
          {item.confidence > 0.8 && (
            <View style={styles.confidenceBadge}>
              <MaterialIcons name="verified" size={moderateScale(14)} color="#4CAF50" />
            </View>
          )}
        </View>

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>
            {item.artist}
          </Text>
          
          {/* Reason badge */}
          <View style={[styles.reasonBadge, { backgroundColor: badge.color + '20' }]}>
            <MaterialCommunityIcons 
              name={badge.icon} 
              size={moderateScale(10)} 
              color={badge.color} 
            />
            <Text style={[styles.reasonText, { color: badge.color }]}>
              {badge.text}
            </Text>
          </View>
        </View>

        {/* Match percentage */}
        <View style={styles.matchContainer}>
          <Text style={styles.matchPercentage}>
            {Math.round(item.confidence * 100)}%
          </Text>
          <Text style={styles.matchLabel}>Match</Text>
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
  onPress 
}: { 
  station: any; 
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.radioCard} onPress={onPress} activeOpacity={0.7}>
    <LinearGradient
      colors={['#D4AF37', '#AA8C30']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.radioGradient}
    >
      <MaterialIcons name="radio" size={moderateScale(32)} color="#fff" />
    </LinearGradient>
    <View style={styles.radioInfo}>
      <Text style={styles.radioTitle}>{station.name}</Text>
      <Text style={styles.radioSubtitle}>{station.description}</Text>
    </View>
    <Feather name="play-circle" size={moderateScale(32)} color={Colors.primary} />
  </TouchableOpacity>
);

// ============================================================================
// CONTEXT MENU MODAL
// ============================================================================
const ContextMenu = ({ 
  visible, 
  onClose, 
  item,
  onPlayNow,
  onAddToQueue,
  onPlayNext,
  onGoToArtist,
  onGoToAlbum,
  onShare,
  onAddToPlaylist
}: {
  visible: boolean;
  onClose: () => void;
  item: Recommendation | null;
  onPlayNow: () => void;
  onAddToQueue: () => void;
  onPlayNext: () => void;
  onGoToArtist: () => void;
  onGoToAlbum: () => void;
  onShare: () => void;
  onAddToPlaylist: () => void;
}) => {
  if (!visible || !item) return null;

  return (
    <View style={styles.contextMenuOverlay}>
      <TouchableOpacity style={styles.contextMenuBackdrop} onPress={onClose} activeOpacity={1} />
      <Animated.View 
        entering={SlideInDown.springify()} 
        exiting={SlideOutDown}
        style={styles.contextMenuContainer}
      >
        <View style={styles.contextMenuHeader}>
          <FastImage
            source={{ uri: item.artwork ?? unknownTrackImageUri }}
            style={styles.contextMenuArtwork}
          />
          <View style={styles.contextMenuHeaderText}>
            <Text style={styles.contextMenuTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.contextMenuArtist} numberOfLines={1}>{item.artist}</Text>
          </View>
        </View>

        <View style={styles.contextMenuDivider} />

        <TouchableOpacity style={styles.contextMenuItem} onPress={onPlayNow}>
          <Feather name="play" size={moderateScale(20)} color="#fff" />
          <Text style={styles.contextMenuItemText}>Play Now</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contextMenuItem} onPress={onPlayNext}>
          <MaterialIcons name="playlist-play" size={moderateScale(20)} color="#fff" />
          <Text style={styles.contextMenuItemText}>Play Next</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contextMenuItem} onPress={onAddToQueue}>
          <MaterialIcons name="queue-music" size={moderateScale(20)} color="#fff" />
          <Text style={styles.contextMenuItemText}>Add to Queue</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.contextMenuItem} onPress={onAddToPlaylist}>
          <MaterialIcons name="playlist-add" size={moderateScale(20)} color="#fff" />
          <Text style={styles.contextMenuItemText}>Add to Playlist</Text>
        </TouchableOpacity>

        <View style={styles.contextMenuDivider} />

        <TouchableOpacity style={styles.contextMenuItem} onPress={onGoToArtist}>
          <MaterialCommunityIcons name="account-music" size={moderateScale(20)} color="#fff" />
          <Text style={styles.contextMenuItemText}>Go to Artist</Text>
        </TouchableOpacity>

        {item.album && (
          <TouchableOpacity style={styles.contextMenuItem} onPress={onGoToAlbum}>
            <MaterialIcons name="album" size={moderateScale(20)} color="#fff" />
            <Text style={styles.contextMenuItemText}>Go to Album</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.contextMenuItem} onPress={onShare}>
          <Feather name="share" size={moderateScale(20)} color="#fff" />
          <Text style={styles.contextMenuItemText}>Share</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ============================================================================
// MAIN RELATED MODAL COMPONENT
// ============================================================================
export default function RelatedModal() {
  const router = useRouter();
  const { id: songId } = useLocalSearchParams<{ id: string }>();
  const { top, bottom } = useSafeAreaInsets();
  const { currentTrack } = useMavinEngine();
  const { isPremium, gracePeriodStatus } = useGracePeriod();
  const { shouldShowAds, startAd } = useAdMonetization();
  
  const [selectedItem, setSelectedItem] = useState<Recommendation | null>(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [recommendationType, setRecommendationType] = useState<RecommendationType>('personalized');
  const flatListRef = useRef<FlatList>(null);

  // ============================================================================
  // ENGINE HOOKS
  // ============================================================================
  const {
    recommendations,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    error
  } = useRecommendations({
    trackId: songId || currentTrack?.id || '',
    type: recommendationType,
    limit: 20
  });

  const { mutate: playNext } = usePlayNext();
  const { mutate: addToQueue } = useAddToQueue();
  const { mutate: createRadio } = useRadioStation();
  const { addToRecentlyPlayed } = useRecentlyPlayed();

  // ============================================================================
  // HANDLERS
  // ============================================================================
  const handlePlayNow = useCallback(async (item: Recommendation) => {
    try {
      triggerHaptic('light');
      
      // Check if this is a premium feature
      if (item.reason === 'trending' && !isPremium && gracePeriodStatus !== 'grace_period') {
        const adCompleted = await startAd(
          'premium_content_unlock',
          'admob',
          'ca-app-pub-3940256099942544/1033173712'
        );
        
        if (!adCompleted) {
          ToastAndroid.show('Premium required for trending songs', ToastAndroid.SHORT);
          return;
        }
      }

      // Convert recommendation to track
      const track = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        album: item.album,
        artwork: item.artwork,
        duration: item.duration,
        videoId: item.videoId
      };

      // Play the track
      await playNext(track);
      
      // Track analytics
      addToRecentlyPlayed(track);
      
      ToastAndroid.show(`Now playing: ${item.title}`, ToastAndroid.SHORT);
      router.back();
    } catch (error) {
      logError(errorFromUnknown(error), 'error');
      ToastAndroid.show('Failed to play song', ToastAndroid.SHORT);
    }
  }, [playNext, addToRecentlyPlayed, router, isPremium, gracePeriodStatus, startAd]);

  const handlePlayNext = useCallback((item: Recommendation) => {
    try {
      triggerHaptic('light');
      
      const track = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        album: item.album,
        artwork: item.artwork,
        duration: item.duration,
        videoId: item.videoId
      };

      playNext(track);
      ToastAndroid.show('Song will play next', ToastAndroid.SHORT);
      setContextMenuVisible(false);
    } catch (error) {
      logError(errorFromUnknown(error), 'error');
      ToastAndroid.show('Failed to add to queue', ToastAndroid.SHORT);
    }
  }, [playNext]);

  const handleAddToQueue = useCallback((item: Recommendation) => {
    try {
      triggerHaptic('light');
      
      const track = {
        id: item.id,
        title: item.title,
        artist: item.artist,
        album: item.album,
        artwork: item.artwork,
        duration: item.duration,
        videoId: item.videoId
      };

      addToQueue(track);
      ToastAndroid.show('Added to queue', ToastAndroid.SHORT);
      setContextMenuVisible(false);
    } catch (error) {
      logError(errorFromUnknown(error), 'error');
      ToastAndroid.show('Failed to add to queue', ToastAndroid.SHORT);
    }
  }, [addToQueue]);

  const handleStartRadio = useCallback(() => {
    try {
      triggerHaptic('light');
      
      createRadio({
        seed: songId || currentTrack?.id || '',
        name: `${currentTrack?.title || 'Song'} Radio`
      });
      
      ToastAndroid.show('Radio station created', ToastAndroid.SHORT);
      router.back();
    } catch (error) {
      logError(errorFromUnknown(error), 'error');
      ToastAndroid.show('Failed to create radio', ToastAndroid.SHORT);
    }
  }, [createRadio, songId, currentTrack, router]);

  const handleMenuPress = useCallback((item: Recommendation) => {
    triggerHaptic('light');
    setSelectedItem(item);
    setContextMenuVisible(true);
  }, []);

  const handleGoToArtist = useCallback((item: Recommendation) => {
    triggerHaptic('light');
    setContextMenuVisible(false);
    router.push({
      pathname: '/(artist)/[id]',
      params: { id: item.artistId, name: item.artist }
    });
  }, [router]);

  const handleGoToAlbum = useCallback((item: Recommendation) => {
    if (!item.albumId) return;
    triggerHaptic('light');
    setContextMenuVisible(false);
    router.push({
      pathname: '/(album)/[id]',
      params: { id: item.albumId, name: item.album }
    });
  }, [router]);

  const handleShare = useCallback(async (item: Recommendation) => {
    triggerHaptic('light');
    setContextMenuVisible(false);
    
    // Share implementation
    const shareUrl = `https://music.youtube.com/watch?v=${item.videoId}`;
    await Share.share({
      message: `Check out "${item.title}" by ${item.artist} ${shareUrl}`,
      title: item.title
    });
  }, []);

  const handleAddToPlaylist = useCallback((item: Recommendation) => {
    triggerHaptic('light');
    setContextMenuVisible(false);
    
    const track = {
      id: item.id,
      title: item.title,
      artist: item.artist,
      thumbnail: item.artwork
    };

    router.push({
      pathname: '/(modals)/addToPlaylist',
      params: { track: JSON.stringify(track) }
    });
  }, [router]);

  const handleRefresh = useCallback(() => {
    triggerHaptic('light');
    refetch();
  }, [refetch]);

  // ============================================================================
  // FILTERED RECOMMENDATIONS
  // ============================================================================
  const { priorityRecs, standardRecs } = useMemo(() => {
    if (!recommendations) return { priorityRecs: [], standardRecs: [] };
    
    const priority = recommendations.filter(r => r.confidence > 0.85);
    const standard = recommendations.filter(r => r.confidence <= 0.85);
    
    return { priorityRecs: priority, standardRecs: standard };
  }, [recommendations]);

  // ============================================================================
  // RENDER FUNCTIONS
  // ============================================================================
  const renderHeader = useCallback(() => (
    <View style={styles.headerContainer}>
      {/* Radio Station Card */}
      <RadioCard 
        station={{
          name: `${currentTrack?.title || 'Song'} Radio`,
          description: 'Endless music based on this song'
        }}
        onPress={handleStartRadio}
      />

      {/* Recommendation Type Tabs */}
      <View style={styles.typeTabs}>
        <TouchableOpacity
          style={[styles.typeTab, recommendationType === 'personalized' && styles.typeTabActive]}
          onPress={() => setRecommendationType('personalized')}
        >
          <Text style={[styles.typeTabText, recommendationType === 'personalized' && styles.typeTabTextActive]}>
            For You
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeTab, recommendationType === 'similar_artist' && styles.typeTabActive]}
          onPress={() => setRecommendationType('similar_artist')}
        >
          <Text style={[styles.typeTabText, recommendationType === 'similar_artist' && styles.typeTabTextActive]}>
            Similar Artists
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeTab, recommendationType === 'trending' && styles.typeTabActive]}
          onPress={() => setRecommendationType('trending')}
        >
          <Text style={[styles.typeTabText, recommendationType === 'trending' && styles.typeTabTextActive]}>
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
  ), [recommendationType, priorityRecs, handlePlayNow, handleMenuPress, handleStartRadio, currentTrack]);

  const renderFooter = useCallback(() => {
    if (!hasNextPage) return null;
    
    return (
      <View style={styles.footerContainer}>
        {isFetchingNextPage ? (
          <ActivityIndicator color={Colors.primary} size="large" />
        ) : (
          <TouchableOpacity style={styles.loadMoreButton} onPress={() => fetchNextPage()}>
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
        <Text style={styles.emptyTitle}>No Recommendations</Text>
        <Text style={styles.emptyText}>
          We couldn't find any recommendations right now. Try again later.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }, [isLoading, handleRefresh]);

  // ============================================================================
  // LOADING STATE
  // ============================================================================
  if (isLoading && !recommendations?.length) {
    return (
      <View style={[defaultStyles.container, styles.loadingContainer]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Finding recommendations...</Text>
        <Text style={styles.loadingSubtext}>Based on your listening history</Text>
      </View>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================
  if (error) {
    return (
      <View style={[defaultStyles.container, styles.errorContainer]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <MaterialCommunityIcons 
          name="cloud-off-outline" 
          size={moderateScale(64)} 
          color="rgba(255,255,255,0.3)" 
        />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Failed to load recommendations'}
        </Text>
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

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  return (
    <View style={[defaultStyles.container, styles.container]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: top + verticalScale(12) }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            triggerHaptic('light');
            router.back();
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={moderateScale(28)} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Related</Text>
          <Text style={styles.headerSubtitle}>
            {recommendations?.length || 0} recommendations
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.headerAction}
          onPress={handleRefresh}
        >
          <Ionicons name="refresh" size={moderateScale(22)} color="#fff" />
        </TouchableOpacity>
      </View>

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
          { paddingBottom: bottom + verticalScale(20) }
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
        onGoToArtist={() => selectedItem && handleGoToArtist(selectedItem)}
        onGoToAlbum={() => selectedItem && handleGoToAlbum(selectedItem)}
        onShare={() => selectedItem && handleShare(selectedItem)}
        onAddToPlaylist={() => selectedItem && handleAddToPlaylist(selectedItem)}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = ScaledSheet.create({
  container: {
    backgroundColor: '#000',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: '18@ms',
    fontWeight: '600',
    marginTop: '20@vs',
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14@ms',
    marginTop: '8@vs',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: '40@s',
  },
  errorTitle: {
    color: '#fff',
    fontSize: '20@ms',
    fontWeight: '700',
    marginTop: '24@vs',
  },
  errorText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14@ms',
    textAlign: 'center',
    marginTop: '8@vs',
    marginBottom: '24@vs',
    lineHeight: '20@ms',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: '16@s',
    paddingBottom: '16@vs',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#000',
  },
  closeButton: {
    width: '40@s',
    height: '40@s',
    borderRadius: '20@s',
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: '18@ms',
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12@ms',
    marginTop: '2@vs',
  },
  headerAction: {
    width: '40@s',
    height: '40@s',
    borderRadius: '20@s',
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: '16@s',
    paddingTop: '8@vs',
  },
  headerContainer: {
    marginBottom: '8@vs',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '24@vs',
    marginBottom: '12@vs',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8@s',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: '16@ms',
    fontWeight: '600',
  },
  viewAllText: {
    color: Colors.primary,
    fontSize: '13@ms',
    fontWeight: '500',
  },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: '12@ms',
    padding: '12@s',
    marginBottom: '16@vs',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  radioGradient: {
    width: '56@ms',
    height: '56@ms',
    borderRadius: '28@ms',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInfo: {
    flex: 1,
    marginLeft: '12@s',
  },
  radioTitle: {
    color: '#fff',
    fontSize: '16@ms',
    fontWeight: '600',
    marginBottom: '4@vs',
  },
  radioSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12@ms',
  },
  typeTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: '20@ms',
    padding: '4@s',
    marginBottom: '8@vs',
  },
  typeTab: {
    flex: 1,
    paddingVertical: '8@vs',
    alignItems: 'center',
    borderRadius: '16@ms',
  },
  typeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  typeTabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12@ms',
    fontWeight: '500',
  },
  typeTabTextActive: {
    color: '#fff',
  },
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '12@ms',
    marginBottom: '8@vs',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  priorityCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: '12@s',
  },
  artworkContainer: {
    position: 'relative',
    width: '50@ms',
    height: '50@ms',
    borderRadius: '8@ms',
    overflow: 'hidden',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  artworkGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '20@ms',
  },
  confidenceBadge: {
    position: 'absolute',
    top: '4@s',
    right: '4@s',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: '10@s',
    padding: '2@s',
  },
  trackInfo: {
    flex: 1,
    marginLeft: '12@s',
  },
  trackTitle: {
    color: '#fff',
    fontSize: '15@ms',
    fontWeight: '500',
    marginBottom: '2@vs',
  },
  trackArtist: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13@ms',
    marginBottom: '4@vs',
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: '6@s',
    paddingVertical: '2@vs',
    borderRadius: '4@s',
    gap: '4@s',
  },
  reasonText: {
    fontSize: '9@ms',
    fontWeight: '600',
  },
  matchContainer: {
    alignItems: 'center',
    marginRight: '8@s',
  },
  matchPercentage: {
    color: Colors.primary,
    fontSize: '16@ms',
    fontWeight: '700',
  },
  matchLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '9@ms',
  },
  menuButton: {
    padding: '12@s',
  },
  footerContainer: {
    paddingVertical: '20@vs',
    alignItems: 'center',
  },
  loadMoreButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: '10@vs',
    paddingHorizontal: '20@s',
    borderRadius: '20@ms',
  },
  loadMoreText: {
    color: '#fff',
    fontSize: '14@ms',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: '60@vs',
    paddingHorizontal: '40@s',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: '18@ms',
    fontWeight: '600',
    marginTop: '16@vs',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14@ms',
    textAlign: 'center',
    marginTop: '8@vs',
    marginBottom: '24@vs',
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: '12@vs',
    paddingHorizontal: '32@s',
    borderRadius: '24@ms',
  },
  retryButtonText: {
    color: '#000',
    fontSize: '14@ms',
    fontWeight: '600',
  },
  closeButton: {
    marginTop: '12@vs',
    paddingVertical: '12@vs',
    paddingHorizontal: '32@s',
  },
  closeButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14@ms',
  },
  contextMenuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  contextMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  contextMenuContainer: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: '20@ms',
    borderTopRightRadius: '20@ms',
    padding: '20@s',
    paddingBottom: '32@vs',
  },
  contextMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: '16@vs',
  },
  contextMenuArtwork: {
    width: '48@ms',
    height: '48@ms',
    borderRadius: '8@ms',
    marginRight: '12@s',
  },
  contextMenuHeaderText: {
    flex: 1,
  },
  contextMenuTitle: {
    color: '#fff',
    fontSize: '16@ms',
    fontWeight: '600',
    marginBottom: '2@vs',
  },
  contextMenuArtist: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14@ms',
  },
  contextMenuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: '12@vs',
  },
  contextMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: '12@vs',
    gap: '12@s',
  },
  contextMenuItemText: {
    color: '#fff',
    fontSize: '15@ms',
  },
});