/**
 * LIBRARY SCREEN — CLIENT-ONLY VIEW
 * No admin/creator analytics | No creator tools | No dashboards
 * Pure client-side personal library management
 * Downloads, Playlists, Liked Songs — User's personal collection only
 */

import React, { useCallback, useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { ScaledSheet, moderateScale } from "react-native-size-matters/extend";

// ============================================================================
// LOCAL IMPORTS — Client Only
// ============================================================================
import { Colors } from "@/constants/Colors";
import { defaultStyles } from "@/styles";
import { triggerHaptic } from "@/helpers/haptics";
import { usePlaylists } from "@/store/library";

// ============================================================================
// MAVIN ENGINE IMPORTS — Client Only Services
// No admin/creator features | No analytics dashboards
// ============================================================================
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { useDownloads } from "@/services/mavin/download/DownloadManager";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";
import { MavinCache } from "@/services/mavin/core/CacheLayer";

// ============================================================================
// TYPES — Client Only Data Structures
// ============================================================================
interface PlaylistItem {
  id: string;
  name: string;
  songCount: number;
  thumbnail?: string | null;
}

interface DownloadedSong {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string | null;
  duration?: number;
}

interface LikedSong {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string | null;
  likedAt: number;
}

// ============================================================================
// CLIENT-ONLY LIBRARY SCREEN
// No creator analytics | No admin dashboards | No monetization metrics
// Pure personal music library experience
// ============================================================================
export default function LibraryScreen() {
  const router = useRouter();
  const { playlists, downloadedSongs: localDownloadedSongs } = usePlaylists();
  const { gracePeriodStatus, isPremium, daysRemaining } = useGracePeriod();
  
  // ==========================================================================
  // CLIENT STATE — Personal Library Only
  // ==========================================================================
  const [refreshing, setRefreshing] = useState(false);
  const [likedSongs, setLikedSongs] = useState<LikedSong[]>([]);
  const [isLoadingLikes, setIsLoadingLikes] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // ==========================================================================
  // MAVIN ENGINE CLIENT HOOKS — Downloads Only
  // ==========================================================================
  const { 
    downloads: engineDownloads, 
    getDownloadProgress,
  } = useDownloads();

  // ==========================================================================
  // CLIENT DATA TRANSFORMATIONS
  // ==========================================================================
  
  // Transform playlists object into array for rendering
  const playlistArray = useMemo<PlaylistItem[]>(() => {
    return Object.entries(playlists).map(([name, songs]) => ({
      id: `playlist-${name}-${Date.now()}`,
      name,
      songCount: songs.length,
      thumbnail: songs[0]?.thumbnail || null,
    }));
  }, [playlists]);

  // Transform downloaded songs for rendering
  const downloadedSongsArray = useMemo<DownloadedSong[]>(() => {
    return localDownloadedSongs.map((song: any) => ({
      id: song.id,
      title: song.title || 'Unknown Track',
      artist: song.artist || 'Unknown Artist',
      thumbnail: song.thumbnail || null,
      duration: song.duration,
    }));
  }, [localDownloadedSongs]);

  // ==========================================================================
  // CLIENT-ONLY FETCH — Personal Liked Songs
  // No analytics | No creator stats | Just user's personal likes
  // ==========================================================================
  const fetchLikedSongs = useCallback(async () => {
    setIsLoadingLikes(true);
    try {
      // Try to get from local cache first
      const cached = await MavinCache.get<LikedSong[]>('user:liked-songs');
      
      if (cached) {
        setLikedSongs(cached);
      } else {
        // Load from local storage only — no server calls
        // This is client-only, user's personal data stays on device
        setLikedSongs([]);
      }
      
    } catch (error) {
      // Silent fail — client can function without this
      console.log('Could not load liked songs');
    } finally {
      setIsLoadingLikes(false);
    }
  }, []);

  // Load liked songs on mount
  useEffect(() => {
    fetchLikedSongs();
    
    // Check network status (client-side only)
    const checkNetwork = () => {
      // Simple client-side network check
      setIsOffline(!navigator.onLine);
    };
    
    checkNetwork();
    
    // Listen for network changes
    window.addEventListener('online', () => setIsOffline(false));
    window.addEventListener('offline', () => setIsOffline(true));
    
    return () => {
      window.removeEventListener('online', () => setIsOffline(false));
      window.removeEventListener('offline', () => setIsOffline(true));
    };
  }, [fetchLikedSongs]);

  // ==========================================================================
  // CLIENT PLAYBACK — Pure Audio Playback
  // No tracking | No analytics | No metrics
  // ==========================================================================
  const handlePlay = useCallback((songId: string, title: string, artist: string, thumbnail?: string | null) => {
    triggerHaptic("light");
    
    // Check if song is downloaded for offline playback
    const isDownloaded = downloadedSongsArray.some(s => s.id === songId);
    
    // Simple client-side dispatch — no analytics
    // Using global event for player
    const playEvent = new CustomEvent('PLAYER_PLAY', {
      detail: {
        trackId: songId,
        title,
        artist,
        thumbnail: thumbnail || null,
        videoId: songId,
        position: 0,
        isOffline: isDownloaded,
      }
    });
    window.dispatchEvent(playEvent);
    
    router.push('/(player)');
  }, [router, downloadedSongsArray]);

  // ==========================================================================
  // CLIENT PLAYLIST PLAYBACK
  // ==========================================================================
  const handlePlayPlaylist = useCallback((playlistName: string) => {
    triggerHaptic("light");
    
    const playlistSongs = playlists[playlistName] || [];
    
    if (playlistSongs.length === 0) {
      Alert.alert('Empty Playlist', 'This playlist has no songs yet.');
      return;
    }
    
    // Simple client-side playlist dispatch
    const playEvent = new CustomEvent('PLAYER_PLAY_PLAYLIST', {
      detail: {
        playlistName,
        tracks: playlistSongs,
        position: 0,
      }
    });
    window.dispatchEvent(playEvent);
    
    router.push('/(player)');
  }, [playlists, router]);

  // ==========================================================================
  // CLIENT REFRESH — Local Data Only
  // No server sync | No cloud calls | Pure local refresh
  // ==========================================================================
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      // Simply reload local data from cache
      await fetchLikedSongs();
      
      // Clear cache to force fresh load on next app start
      await MavinCache.remove('user:library-timestamp');
      
      triggerHaptic("success");
      
    } catch (error) {
      // Silent fail — client can function without refresh
    } finally {
      setRefreshing(false);
    }
  }, [fetchLikedSongs]);

  // ==========================================================================
  // CLIENT-ONLY LIBRARY SECTIONS
  // No creator tools | No admin views | No analytics dashboards
  // Pure personal collection sections
  // ==========================================================================
  const sections = [
    {
      title: "Downloaded Songs",
      data: downloadedSongsArray,
      icon: "download-outline",
      iconFilled: "download",
      color: "#4CAF50",
      onPress: () => router.push('/(tabs)/downloads'),
      onItemPress: (item: DownloadedSong) => handlePlay(
        item.id, 
        item.title, 
        item.artist, 
        item.thumbnail
      ),
      emptyText: "No downloaded songs yet",
      emptyIcon: "cloud-download-outline",
    },
    {
      title: "My Playlists",
      data: playlistArray,
      icon: "playlist-outline",
      iconFilled: "playlist",
      color: Colors.primary,
      onPress: () => router.push('/(tabs)/playlists'),
      onItemPress: (item: PlaylistItem) => handlePlayPlaylist(item.name),
      emptyText: "Create your first playlist",
      emptyIcon: "playlist-plus",
    },
    {
      title: "Liked Songs",
      data: likedSongs,
      icon: "heart-outline",
      iconFilled: "heart",
      color: "#FF4081",
      onPress: () => router.push('/(tabs)/likes'),
      onItemPress: (item: LikedSong) => handlePlay(
        item.id, 
        item.title, 
        item.artist, 
        item.thumbnail
      ),
      emptyText: "No liked songs yet",
      emptyIcon: "heart-outline",
      isLoading: isLoadingLikes,
    },
  ];

  // ==========================================================================
  // RENDER SECTION ITEM — Client Card Design
  // ==========================================================================
  const renderSectionItem = useCallback(({ item, section }: { item: any; section: any }) => (
    <TouchableOpacity 
      style={styles.sectionItem} 
      onPress={() => section.onItemPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.sectionItemContent}>
        <View style={[styles.sectionItemIcon, { backgroundColor: `${section.color}15` }]}>
          {item.thumbnail ? (
            // Simple placeholder for thumbnail
            <View style={styles.sectionItemThumbnail} />
          ) : (
            <MaterialIcons 
              name={section.iconFilled} 
              size={moderateScale(24)} 
              color={section.color} 
            />
          )}
        </View>
        
        <View style={styles.sectionItemInfo}>
          <Text style={styles.sectionItemTitle} numberOfLines={1}>
            {item.title || item.name}
          </Text>
          <Text style={styles.sectionItemSubtitle} numberOfLines={1}>
            {item.artist || `${item.songCount} ${item.songCount === 1 ? 'song' : 'songs'}`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  ), []);

  // ==========================================================================
  // RENDER SECTION
  // ==========================================================================
  const renderSection = useCallback(({ item }: { item: typeof sections[0] }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Ionicons 
            name={item.icon as any} 
            size={moderateScale(20)} 
            color={item.color} 
          />
          <Text style={[styles.sectionTitle, { color: item.color }]}>
            {item.title}
          </Text>
          {item.isLoading && (
            <ActivityIndicator size="small" color={item.color} style={styles.sectionLoader} />
          )}
        </View>
        
        <TouchableOpacity 
          onPress={item.onPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.seeAll, { color: item.color }]}>See All</Text>
        </TouchableOpacity>
      </View>
      
      {item.data.length > 0 ? (
        <FlatList
          data={item.data.slice(0, 5)}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionList}
          renderItem={(props) => renderSectionItem({ ...props, section: item })}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      ) : (
        <TouchableOpacity 
          style={styles.emptySection} 
          onPress={item.onPress}
          activeOpacity={0.7}
        >
          <MaterialIcons 
            name={item.emptyIcon as any} 
            size={moderateScale(48)} 
            color={Colors.textMuted} 
          />
          <Text style={styles.emptySectionText}>{item.emptyText}</Text>
          <View style={styles.emptySectionButton}>
            <Text style={styles.emptySectionButtonText}>
              {item.title === "My Playlists" ? "Create Playlist" : "Browse"}
            </Text>
            <Ionicons name="arrow-forward" size={moderateScale(14)} color={item.color} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  ), [renderSectionItem]);

  // ==========================================================================
  // RENDER HEADER — No Admin Elements
  // ==========================================================================
  const renderHeader = useCallback(() => (
    <View style={styles.header}>
      <View>
        <Text style={styles.greeting}>My Library</Text>
        <Text style={styles.username}>Your Collection</Text>
      </View>
      
      <View style={styles.headerActions}>
        {/* Settings Only — No Admin Tools */}
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => router.push('/(modals)/settings')}
        >
          <Ionicons name="settings-outline" size={moderateScale(22)} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  ), [router]);

  // ==========================================================================
  // RENDER PREMIUM BADGE — Client Benefits Only
  // No creator payouts | No monetization dashboards
  // ==========================================================================
  const renderPremiumBadge = useCallback(() => {
    if (!(gracePeriodStatus === 'grace_period' || isPremium)) return null;
    
    return (
      <BlurView intensity={80} tint="dark" style={styles.graceContainer}>
        <View style={styles.graceContent}>
          <View style={styles.graceBadge}>
            <Ionicons 
              name={isPremium ? "shield-checkmark" : "time"} 
              size={moderateScale(16)} 
              color={isPremium ? "#4CAF50" : Colors.primary} 
            />
            <Text style={[
              styles.graceBadgeText,
              isPremium ? styles.premiumBadgeText : styles.graceBadgeTextActive
            ]}>
              {isPremium 
                ? 'Premium Member' 
                : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} of Premium left`
              }
            </Text>
          </View>
          
          {!isPremium && (
            <TouchableOpacity 
              style={styles.upgradeButton}
              onPress={() => {
                triggerHaptic("light");
                router.push('/(modals)/premium');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeButtonText}>Get Premium</Text>
              <Ionicons name="sparkles" size={moderateScale(14)} color="#000" />
            </TouchableOpacity>
          )}
        </View>
      </BlurView>
    );
  }, [gracePeriodStatus, isPremium, daysRemaining, router]);

  // ==========================================================================
  // RENDER STORAGE INFO — Client Device Only
  // ==========================================================================
  const renderStorageInfo = useCallback(() => {
    if (downloadedSongsArray.length === 0) return null;
    
    const totalSize = downloadedSongsArray.length * 5; // Approx 5MB per song
    const usedStorage = Math.min(totalSize, 100);
    
    return (
      <TouchableOpacity 
        style={styles.storageContainer}
        onPress={() => router.push('/(modals)/storage')}
        activeOpacity={0.7}
      >
        <View style={styles.storageHeader}>
          <View style={styles.storageTitleContainer}>
            <MaterialIcons name="storage" size={moderateScale(16)} color={Colors.textMuted} />
            <Text style={styles.storageTitle}>Device Storage</Text>
          </View>
          <Text style={styles.storageSize}>{usedStorage}MB used</Text>
        </View>
        
        <View style={styles.storageBar}>
          <View style={[styles.storageBarFill, { width: `${usedStorage}%` }]} />
        </View>
        
        <Text style={styles.storageSubtext}>
          {downloadedSongsArray.length} downloaded songs on this device
        </Text>
      </TouchableOpacity>
    );
  }, [downloadedSongsArray.length, router]);

  // ==========================================================================
  // MAIN RENDER — Pure Client Interface
  // No creator tools | No admin dashboards | No analytics
  // ==========================================================================
  return (
    <SafeAreaView style={[defaultStyles.container, styles.container]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            titleColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header — Personal Library Only */}
        {renderHeader()}

        {/* Premium Badge — Client Benefits */}
        {renderPremiumBadge()}

        {/* Storage Info — Local Device Only */}
        {renderStorageInfo()}

        {/* Library Sections — Personal Collections */}
        <View style={styles.sectionsContainer}>
          {sections.map((section) => (
            <View key={section.title}>
              {renderSection({ item: section })}
            </View>
          ))}
        </View>

        {/* Offline Mode Indicator */}
        {isOffline && (
          <View style={styles.offlineContainer}>
            <MaterialIcons name="wifi-off" size={moderateScale(16)} color={Colors.textMuted} />
            <Text style={styles.offlineText}>You're offline — Playing downloaded songs</Text>
          </View>
        )}

        {/* Client Version */}
        <Text style={styles.versionText}>Mavin Player v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// CLIENT-ONLY STYLES
// No admin elements | No creator tools | Pure personal library
// ============================================================================
const styles = ScaledSheet.create({
  container: {
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: "40@vs",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: "20@s",
    paddingVertical: "24@vs",
  },
  greeting: {
    color: Colors.textMuted,
    fontSize: "14@ms",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  username: {
    color: Colors.text,
    fontSize: "28@ms",
    fontWeight: "700",
    marginTop: "4@vs",
  },
  headerActions: {
    flexDirection: "row",
  },
  headerButton: {
    width: "44@s",
    height: "44@s",
    borderRadius: "22@s",
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  graceContainer: {
    marginHorizontal: "20@s",
    marginBottom: "24@vs",
    borderRadius: "16@s",
    overflow: "hidden",
  },
  graceContent: {
    padding: "16@s",
  },
  graceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: "8@s",
    marginBottom: "12@vs",
  },
  graceBadgeText: {
    fontSize: "14@ms",
    fontWeight: "600",
  },
  graceBadgeTextActive: {
    color: Colors.primary,
  },
  premiumBadgeText: {
    color: "#4CAF50",
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "8@s",
    backgroundColor: Colors.primary,
    paddingVertical: "10@vs",
    borderRadius: "12@s",
  },
  upgradeButtonText: {
    color: "#000",
    fontSize: "14@ms",
    fontWeight: "600",
  },
  storageContainer: {
    marginHorizontal: "20@s",
    marginBottom: "24@vs",
    padding: "16@s",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: "16@s",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  storageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12@vs",
  },
  storageTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: "8@s",
  },
  storageTitle: {
    color: Colors.textMuted,
    fontSize: "13@ms",
  },
  storageSize: {
    color: Colors.text,
    fontSize: "13@ms",
    fontWeight: "500",
  },
  storageBar: {
    height: "4@vs",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: "2@s",
    marginBottom: "8@vs",
  },
  storageBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: "2@s",
  },
  storageSubtext: {
    color: Colors.textMuted,
    fontSize: "11@ms",
  },
  sectionsContainer: {
    paddingTop: "8@vs",
  },
  section: {
    marginBottom: "32@vs",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: "20@s",
    marginBottom: "16@vs",
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: "8@s",
  },
  sectionTitle: {
    fontSize: "18@ms",
    fontWeight: "600",
  },
  sectionLoader: {
    marginLeft: "8@s",
  },
  seeAll: {
    fontSize: "13@ms",
    fontWeight: "500",
  },
  sectionList: {
    paddingHorizontal: "20@s",
    gap: "12@s",
  },
  sectionItem: {
    width: "160@s",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: "12@s",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  sectionItemContent: {
    padding: "12@s",
    flexDirection: "row",
    alignItems: "center",
    gap: "12@s",
  },
  sectionItemIcon: {
    width: "48@s",
    height: "48@s",
    borderRadius: "10@s",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionItemThumbnail: {
    width: "48@s",
    height: "48@s",
    borderRadius: "10@s",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  sectionItemInfo: {
    flex: 1,
  },
  sectionItemTitle: {
    color: Colors.text,
    fontSize: "14@ms",
    fontWeight: "500",
    marginBottom: "2@vs",
  },
  sectionItemSubtitle: {
    color: Colors.textMuted,
    fontSize: "12@ms",
  },
  emptySection: {
    alignItems: "center",
    paddingVertical: "32@vs",
    marginHorizontal: "20@s",
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: "16@s",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderStyle: "dashed",
  },
  emptySectionText: {
    color: Colors.textMuted,
    fontSize: "14@ms",
    marginTop: "12@vs",
    marginBottom: "16@vs",
    textAlign: "center",
  },
  emptySectionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: "8@s",
    paddingHorizontal: "16@s",
    paddingVertical: "8@vs",
    backgroundColor: "rgba(212,175,55,0.1)",
    borderRadius: "20@s",
  },
  emptySectionButtonText: {
    color: Colors.primary,
    fontSize: "13@ms",
    fontWeight: "500",
  },
  offlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "8@s",
    marginTop: "20@vs",
    paddingVertical: "12@vs",
  },
  offlineText: {
    color: Colors.textMuted,
    fontSize: "12@ms",
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: "11@ms",
    textAlign: "center",
    marginTop: "24@vs",
    opacity: 0.5,
  },
});