// app/(tabs)/index.tsx
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ScaledSheet, moderateScale, verticalScale, scale } from "react-native-size-matters/extend";
import { Colors } from "@/constants/Colors";
import { defaultStyles } from "@/styles";
import { triggerHaptic } from "@/helpers/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { z } from "zod";

// ============================================================================
// MAVIN ENGINE INTEGRATIONS (TanStack Query + Zod)
// ============================================================================
import { 
  useGracePeriod, 
  useAdMonetization,
  type GracePeriodStatus 
} from "@/services/mavin/monetization/GracePeriod";
import { 
  useMavinEngine,
  type EngineAction 
} from "@/services/mavin/core/Engine";
import { 
  useEngagementMetrics,
  type EngagementMetrics 
} from "@/services/mavin/engagement/EngagementEngine";
import { 
  useExtractionChamber,
  type ExtractionResult 
} from "@/services/mavin/extraction/useExtractionChamber";
import { MavinCache } from "@/services/mavin/core/CacheLayer";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";

// ============================================================================
// ZOD VALIDATION (Type Safety)
// ============================================================================
const SongSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().optional(),
  artwork: z.string().url().or(z.string().startsWith("file://")).optional(),
  duration: z.number().int().positive(),
  videoId: z.string().min(10),
  genre: z.string().optional(),
  isrc: z.string().optional(),
});

const ChartSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  songs: z.array(SongSchema),
  type: z.enum(['chart', 'playlist', 'recommendation']),
});

type Song = z.infer<typeof SongSchema>;
type ChartSection = z.infer<typeof ChartSectionSchema>;

// ============================================================================
// REUSABLE SONG CARD COMPONENT (Optimized Rendering)
// ============================================================================
const SongCard = React.memo(({ 
  song, 
  onPress, 
  showEngagement = true,
  index 
}: { 
  song: Song; 
  onPress: () => void; 
  showEngagement?: boolean;
  index: number;
}) => {
  const {  metrics, isLoading: metricsLoading } = useEngagementMetrics(song.id);
  const { gracePeriodStatus, isPremium } = useGracePeriod();
  
  // Format engagement counts with K/M suffixes
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <TouchableOpacity 
      style={styles.songCard} 
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityLabel={`${song.title} by ${song.artist}`}
    >
      <View style={styles.cardContent}>
        <View style={styles.artworkContainer}>
          <View style={styles.artworkPlaceholder}>
            <Text style={styles.trackNumber}>{index + 1}</Text>
          </View>
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {song.artist}
          </Text>
          
          {showEngagement && metrics && (
            <View style={styles.engagementRow}>
              <View style={styles.engagementItem}>
                <MaterialIcons name="thumb-up" size={moderateScale(12)} color="#FFD700" />
                <Text style={styles.engagementText}>
                  {formatCount(metrics.appLikeCount)}
                </Text>
              </View>
              <View style={styles.engagementItem}>
                <MaterialIcons name="comment" size={moderateScale(12)} color="#FFD700" />
                <Text style={styles.engagementText}>
                  {formatCount(metrics.appCommentCount)}
                </Text>
              </View>
              <View style={styles.engagementItem}>
                <MaterialIcons name="share" size={moderateScale(12)} color="#FFD700" />
                <Text style={styles.engagementText}>
                  {formatCount(metrics.appShareCount)}
                </Text>
              </View>
            </View>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.playButton} 
          onPress={(e) => {
            e.stopPropagation();
            triggerHaptic("light");
            onPress();
          }}
          accessibilityLabel="Play song"
        >
          <Ionicons name="play" size={moderateScale(18)} color="#000" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

// ============================================================================
// HOME SCREEN (Engine Integration Only - Zero UI Changes)
// ============================================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HomeScreen = () => {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { gracePeriodStatus, isPremium, daysRemaining } = useGracePeriod();
  const { shouldShowAds, incrementCategoryExitCount, startAd } = useAdMonetization();
  const engine = useMavinEngine();
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const lastCategoryExitTime = useRef(0);

  // ============================================================================
  // PRE-CACHE NIGERIA TOP 50 ON FIRST OPEN (Critical for offline capability)
  // ============================================================================
  useEffect(() => {
    const preCacheNigeriaTop50 = async () => {
      try {
        // Check if already cached
        const cached = await MavinCache.get('chart:nigeria-top-50', async () => { throw new Error('MISS'); });
        if (cached) return;
        
        console.log('[Mavin Home] Pre-caching Nigeria Top 50...');
        
        // Fetch chart data from Supabase
        const response = await fetch('/api/charts/nigeria-top-50');
        if (!response.ok) throw new Error('Failed to fetch chart');
        
        const chartData = await response.json();
        const songs = z.array(SongSchema).parse(chartData.songs);
        
        // Cache chart metadata
        await MavinCache.set(
          'chart:nigeria-top-50',
          { songs, lastUpdated: Date.now() },
          24 * 60 * 60 * 1000, // 24 hours
          'L1_DEVICE'
        );
        
        // Pre-extract audio URLs in background (non-blocking)
        songs.slice(0, 10).forEach(song => {
          useExtractionChamber(song.videoId, {
            genre: song.genre,
            enabled: false, // Will be enabled on demand
          });
        });
        
        console.log('[Mavin Home] Nigeria Top 50 pre-cached successfully');
      } catch (error) {
        logError(errorFromUnknown(error), 'warn');
      }
    };
    
    preCacheNigeriaTop50();
  }, []);

  // ============================================================================
  // FETCH CHART SECTIONS WITH TANSTACK QUERY (Cache-First Strategy)
  // ============================================================================
  const { 
     sections, 
    isLoading, 
    refetch,
    isRefetching 
  } = useQuery<ChartSection[]>({
    queryKey: ['home_sections', gracePeriodStatus, isPremium],
    queryFn: async () => {
      // Check L1 cache first
      try {
        const cached = await MavinCache.get<ChartSection[]>('home_sections', async () => { throw new Error('MISS'); });
        if (cached) {
          console.log('[Mavin Home] Cache HIT for home sections');
          return cached;
        }
      } catch (e) {
        // Cache miss - proceed to fetch
      }
      
      // Fetch from backend
      const response = await fetch('/api/home/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gracePeriodStatus, 
          isPremium,
          deviceFingerprint: await MavinCache.get('device_fingerprint', async () => 'unknown')
        }),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const validated = z.array(ChartSectionSchema).parse(data.sections);
      
      // Cache for 1 hour (charts update daily)
      await MavinCache.set('home_sections', validated, 60 * 60 * 1000, 'L1_DEVICE');
      
      return validated;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    initialData: [], // Prevents loading state on cached data
  });

  // ============================================================================
  // HANDLE SONG PLAYBACK (Engine Integration)
  // ============================================================================
  const handlePlaySong = useCallback((song: Song) => {
    triggerHaptic("light");
    
    // Dispatch play action to Mavin Engine
    engine.dispatch({
      type: 'PLAY',
      trackId: song.id,
      videoId: song.videoId,
      position: 0,
    });
    
    // Navigate to player screen
    router.push('/(player)');
  }, [engine, router]);

  // ============================================================================
  // HANDLE CATEGORY EXIT (Ad Trigger Logic)
  // ============================================================================
  const handleCategoryExit = useCallback(async (sectionId: string) => {
    // Premium/grace period users: No ads, just track exit
    if (isPremium || gracePeriodStatus === 'grace_period') {
      incrementCategoryExitCount();
      return;
    }
    
    // Free users: Check if ad should trigger (every 2nd exit)
    incrementCategoryExitCount();
    
    if (shouldShowAds && engine.shouldTriggerCategoryExit()) {
      const now = Date.now();
      const timeSinceLastAd = now - lastCategoryExitTime.current;
      
      // Prevent ad spam (min 30 seconds between ads)
      if (timeSinceLastAd < 30000) return;
      
      lastCategoryExitTime.current = now;
      
      // Show interstitial ad
      const adCompleted = await startAd(
        'category_exit',
        'admob',
        'ca-app-pub-3940256099942544/1033173712', // Test ad unit
        undefined
      );
      
      if (adCompleted) {
        console.log('[Mavin Home] Category exit ad completed');
      }
    }
  }, [isPremium, gracePeriodStatus, shouldShowAds, engine, incrementCategoryExitCount, startAd]);

  // ============================================================================
  // HANDLE SECTION NAVIGATION (Track exits for ad triggers)
  // ============================================================================
  const handleSectionPress = useCallback((section: ChartSection) => {
    triggerHaptic("light");
    
    // Track active section for exit detection
    setActiveSection(section.id);
    
    // Navigate to section screen (category screen)
    router.push({
      pathname: '/(tabs)/category',
      params: { 
        sectionId: section.id,
        title: section.title,
        type: section.type 
      }
    });
  }, [router]);

  // ============================================================================
  // HANDLE PULL-TO-REFRESH (Respect Grace Period)
  // ============================================================================
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    // Premium/grace period users: Full refresh
    if (isPremium || gracePeriodStatus === 'grace_period') {
      await refetch();
      setRefreshing(false);
      return;
    }
    
    // Free users: Limited refresh (respect ad experience)
    if (Date.now() - (lastCategoryExitTime.current || 0) > 60000) {
      await refetch();
      lastCategoryExitTime.current = Date.now();
    }
    
    setRefreshing(false);
  }, [isPremium, gracePeriodStatus, refetch]);

  // ============================================================================
  // RENDER SECTION HEADER WITH GRACE PERIOD BADGE
  // ============================================================================
  const renderSectionHeader = useCallback((section: ChartSection) => {
    const showGraceBadge = 
      gracePeriodStatus === 'grace_period' && 
      daysRemaining > 0 && 
      section.id === 'nigeria-top-50';
    
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {showGraceBadge && (
            <View style={styles.graceBadge}>
              <Text style={styles.graceBadgeText}>
                {daysRemaining}d left • Ad-free
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity 
          onPress={() => handleSectionPress(section)}
          accessibilityLabel={`View all ${section.title}`}
        >
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
    );
  }, [gracePeriodStatus, daysRemaining, handleSectionPress]);

  // ============================================================================
  // RENDER SECTION CONTENT
  // ============================================================================
  const renderSectionContent = useCallback(({ item }: { item: ChartSection }) => {
    return (
      <View style={styles.section}>
        {renderSectionHeader(item)}
        <FlatList
          data={item.songs}
          keyExtractor={(song) => song.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.songList}
          renderItem={({ item: song, index }) => (
            <SongCard 
              song={song} 
              onPress={() => handlePlaySong(song)} 
              index={index} 
            />
          )}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      </View>
    );
  }, [renderSectionHeader, handlePlaySong]);

  // ============================================================================
  // LOADING & EMPTY STATES
  // ============================================================================
  if (isLoading && sections.length === 0) {
    return (
      <SafeAreaView style={[defaultStyles.container, { backgroundColor: '#000' }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>
            {gracePeriodStatus === 'grace_period' 
              ? 'Setting up your ad-free experience...' 
              : 'Loading music...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (sections.length === 0) {
    return (
      <SafeAreaView style={[defaultStyles.container, { backgroundColor: '#000' }]}>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="queue-music" size={64} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>No music available</Text>
          <Text style={styles.emptyText}>
            {gracePeriodStatus === 'grace_period'
              ? 'Your ad-free experience is being prepared'
              : 'Check back later for fresh content'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => refetch()}
            disabled={isRefetching}
          >
            <Text style={styles.retryButtonText}>
              {isRefetching ? 'Refreshing...' : 'Retry'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================================
  // MAIN RENDER (Zero UI Changes - Pure Logic Integration)
  // ============================================================================
  return (
    <SafeAreaView style={[defaultStyles.container, { backgroundColor: '#000', paddingTop: top }]}>
      <LinearGradient
        colors={["#1a0f05", "#0b0b0b", "#050505"]}
        style={styles.gradientBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <ScrollView
          ref={scrollRef}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isRefetching}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              titleColor={Colors.primary}
              title={gracePeriodStatus === 'grace_period' ? "Refreshing (ad-free)" : "Refreshing..."}
            />
          }
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.username}>Welcome back</Text>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.searchButton}
                onPress={() => {
                  triggerHaptic("light");
                  router.push('/search');
                }}
                accessibilityLabel="Search music"
              >
                <Ionicons name="search" size={moderateScale(22)} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.profileButton}
                onPress={() => {
                  triggerHaptic("light");
                  router.push('/profile');
                }}
                accessibilityLabel="Profile"
              >
                <MaterialIcons name="account-circle" size={moderateScale(28)} color="#fff" />
                {gracePeriodStatus === 'grace_period' && (
                  <View style={styles.graceIndicator} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* CHART SECTIONS */}
          {sections.map((section) => (
            <View key={section.id} style={styles.section}>
              {renderSectionHeader(section)}
              <FlatList
                data={section.songs}
                keyExtractor={(song) => song.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.songList}
                renderItem={({ item: song, index }) => (
                  <SongCard 
                    song={song} 
                    onPress={() => handlePlaySong(song)} 
                    index={index} 
                  />
                )}
                initialNumToRender={5}
                maxToRenderPerBatch={3}
                windowSize={5}
              />
            </View>
          ))}

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {gracePeriodStatus === 'grace_period'
                ? `✨ Ad-free for ${daysRemaining} more days`
                : isPremium
                  ? '✨ Premium member'
                  : 'Free version • Upgrade for ad-free experience'}
            </Text>
            {!isPremium && gracePeriodStatus !== 'grace_period' && (
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => {
                  triggerHaptic("medium");
                  router.push('/premium');
                }}
              >
                <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                <Ionicons name="sparkles" size={moderateScale(16)} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES (UNCHANGED - Pure UI Preservation)
// ============================================================================
const styles = ScaledSheet.create({
  gradientBackground: { flex: 1 },
  scrollContent: { paddingBottom: verticalScale(40) },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: verticalScale(40),
  },
  loadingText: {
    color: Colors.text,
    fontSize: moderateScale(16),
    marginTop: verticalScale(16),
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: verticalScale(40),
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: moderateScale(20),
    fontWeight: "700",
    marginTop: verticalScale(24),
    textAlign: "center",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: moderateScale(14),
    marginTop: verticalScale(8),
    textAlign: "center",
    lineHeight: moderateScale(20),
  },
  retryButton: {
    marginTop: verticalScale(24),
    paddingHorizontal: scale(32),
    paddingVertical: verticalScale(12),
    backgroundColor: Colors.primary,
    borderRadius: scale(20),
  },
  retryButtonText: {
    color: "#000",
    fontSize: moderateScale(16),
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: scale(20),
    paddingVertical: verticalScale(16),
  },
  greeting: {
    color: Colors.textMuted,
    fontSize: moderateScale(16),
  },
  username: {
    color: Colors.text,
    fontSize: moderateScale(24),
    fontWeight: "700",
    marginTop: verticalScale(2),
  },
  headerActions: {
    flexDirection: "row",
    gap: scale(12),
  },
  searchButton: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  profileButton: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  graceIndicator: {
    position: "absolute",
    top: -scale(4),
    right: -scale(4),
    width: scale(12),
    height: scale(12),
    borderRadius: scale(6),
    backgroundColor: "#00FF00",
    borderWidth: 1,
    borderColor: "#000",
  },
  section: {
    marginBottom: verticalScale(24),
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: scale(20),
    marginBottom: verticalScale(16),
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: moderateScale(20),
    fontWeight: "700",
  },
  graceBadge: {
    backgroundColor: "rgba(0, 255, 0, 0.15)",
    paddingHorizontal: scale(8),
    paddingVertical: verticalScale(2),
    borderRadius: scale(10),
  },
  graceBadgeText: {
    color: "#00FF00",
    fontSize: moderateScale(11),
    fontWeight: "500",
  },
  seeAll: {
    color: Colors.primary,
    fontSize: moderateScale(14),
    fontWeight: "600",
  },
  songList: {
    paddingHorizontal: scale(20),
  },
  songCard: {
    width: SCREEN_WIDTH * 0.65,
    marginRight: scale(16),
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: scale(16),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: scale(12),
  },
  artworkContainer: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(8),
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: scale(12),
  },
  artworkPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  trackNumber: {
    color: Colors.textMuted,
    fontSize: moderateScale(18),
    fontWeight: "700",
  },
  infoContainer: {
    flex: 1,
    justifyContent: "center",
  },
  songTitle: {
    color: Colors.text,
    fontSize: moderateScale(15),
    fontWeight: "600",
    marginBottom: verticalScale(2),
  },
  songArtist: {
    color: Colors.textMuted,
    fontSize: moderateScale(13),
  },
  engagementRow: {
    flexDirection: "row",
    gap: scale(12),
    marginTop: verticalScale(6),
  },
  engagementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  engagementText: {
    color: "rgba(255,215,0,0.9)",
    fontSize: moderateScale(11),
    fontWeight: "500",
  },
  playButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: "auto",
  },
  footer: {
    alignItems: "center",
    paddingVertical: verticalScale(24),
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    marginTop: verticalScale(16),
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: moderateScale(14),
    marginBottom: verticalScale(16),
    textAlign: "center",
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: Colors.primary,
    paddingHorizontal: scale(24),
    paddingVertical: verticalScale(10),
    borderRadius: scale(20),
  },
  upgradeButtonText: {
    color: "#000",
    fontSize: moderateScale(15),
    fontWeight: "600",
  },
});

export default HomeScreen;