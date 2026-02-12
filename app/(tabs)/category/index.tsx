import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ScaledSheet, moderateScale } from "react-native-size-matters/extend";
import { Colors } from "@/constants/Colors";
import { defaultStyles } from "@/styles";
import { triggerHaptic } from "@/helpers/haptics";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";

// ============================================================================
// MAVIN ENGINE INTEGRATIONS
// ============================================================================
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { useAdMonetization } from "@/services/mavin/monetization/AdMonetization";
import { useMavinEngine } from "@/services/mavin/core/Engine";
import { MavinCache } from "@/services/mavin/core/CacheLayer";

// ============================================================================
// ZOD VALIDATION
// ============================================================================
const CategorySongSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  artwork: z.string().url().optional(),
  duration: z.number().int().positive(),
  videoId: z.string(),
});

type CategorySong = z.infer<typeof CategorySongSchema>;

// ============================================================================
// CATEGORY SCREEN
// ============================================================================
const CategoryScreen = () => {
  const router = useRouter();
  const { sectionId, title, type } = useLocalSearchParams<{ 
    sectionId: string; 
    title: string; 
    type: string;
  }>();
  const { gracePeriodStatus, isPremium } = useGracePeriod();
  const { incrementCategoryExitCount, shouldShowAds } = useAdMonetization();
  const engine = useMavinEngine();

  // ============================================================================
  // FETCH CATEGORY DATA (Cache-First)
  // ============================================================================
  const {  songs, isLoading } = useQuery<CategorySong[]>({
    queryKey: ['category', sectionId],
    queryFn: async () => {
      // Check cache first
      try {
        const cached = await MavinCache.get<CategorySong[]>(`category:${sectionId}`, async () => { throw new Error('MISS'); });
        if (cached) return cached;
      } catch (e) {
        // Cache miss
      }
      
      // Mock data (replace with actual API call in production)
      const mockSongs: CategorySong[] = Array.from({ length: 20 }, (_, i) => ({
        id: `song-${sectionId}-${i}`,
        title: `${title} Song ${i + 1}`,
        artist: `Artist ${i + 1}`,
        videoId: `video-${i}`,
        duration: 180 + Math.floor(Math.random() * 120),
      }));
      
      // Cache for 1 hour
      await MavinCache.set(`category:${sectionId}`, mockSongs, 60 * 60 * 1000, 'L1_DEVICE');
      
      return mockSongs;
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    placeholderData: [],
  });

  // ============================================================================
  // HANDLE BACK NAVIGATION (Ad Trigger Point)
  // ============================================================================
  const handleBack = useCallback(() => {
    triggerHaptic("light");
    
    // Track category exit (critical for ad triggers)
    incrementCategoryExitCount();
    
    // Navigate back
    router.back();
  }, [incrementCategoryExitCount, router]);

  // ============================================================================
  // HANDLE PLAY (Engine Integration)
  // ============================================================================
  const handlePlay = useCallback((song: CategorySong) => {
    triggerHaptic("light");
    
    engine.dispatch({
      type: 'PLAY',
      trackId: song.id,
      videoId: song.videoId,
      position: 0,
    });
    
    router.push('/(player)');
  }, [engine, router]);

  // ============================================================================
  // RENDER SONG ITEM
  // ============================================================================
  const renderSong = useCallback(({ item, index }: { item: CategorySong; index: number }) => (
    <TouchableOpacity 
      style={styles.songItem} 
      onPress={() => handlePlay(item)}
      activeOpacity={0.85}
    >
      <View style={styles.songContent}>
        <View style={styles.trackNumberContainer}>
          <Text style={styles.trackNumber}>{index + 1}</Text>
        </View>
        
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.songArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
        
        <View style={styles.durationContainer}>
          <Text style={styles.durationText}>
            {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
          </Text>
          <Ionicons name="play" size={moderateScale(16)} color={Colors.primary} style={styles.playIcon} />
        </View>
      </View>
    </TouchableOpacity>
  ), [handlePlay]);

  // ============================================================================
  // UI RENDER
  // ============================================================================
  return (
    <SafeAreaView style={[defaultStyles.container, styles.container]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={moderateScale(24)} color={Colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.headerSubtitle}>
            {songs?.length || 0} songs
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          {gracePeriodStatus === 'grace_period' && (
            <View style={styles.graceBadge}>
              <Text style={styles.graceBadgeText}>Ad-free</Text>
            </View>
          )}
        </View>
      </View>

      {/* SONG LIST */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item) => item.id}
          renderItem={renderSong}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
        />
      )}
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES
// ============================================================================
const styles = ScaledSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingTop: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: "16@s",
    paddingVertical: "16@vs",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    backgroundColor: Colors.background,
  },
  backButton: {
    width: "36@s",
    height: "36@s",
    borderRadius: "18@s",
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: "12@s",
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: "22@ms",
    fontWeight: "700",
  },
  headerSubtitle: {
    color: Colors.textMuted,
    fontSize: "14@ms",
    marginTop: "4@vs",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  graceBadge: {
    backgroundColor: "rgba(0, 255, 0, 0.15)",
    paddingHorizontal: "8@s",
    paddingVertical: "4@vs",
    borderRadius: "10@s",
  },
  graceBadgeText: {
    color: "#00FF00",
    fontSize: "11@ms",
    fontWeight: "500",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: "40@vs",
  },
  listContent: {
    paddingVertical: "16@vs",
    paddingHorizontal: "16@s",
  },
  songItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: "12@s",
    marginBottom: "12@vs",
    padding: "14@s",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  songContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  trackNumberContainer: {
    width: "32@s",
    height: "32@s",
    borderRadius: "16@s",
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: "12@s",
  },
  trackNumber: {
    color: Colors.text,
    fontSize: "14@ms",
    fontWeight: "600",
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    color: Colors.text,
    fontSize: "16@ms",
    fontWeight: "600",
    marginBottom: "2@vs",
  },
  songArtist: {
    color: Colors.textMuted,
    fontSize: "13@ms",
  },
  durationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: "8@s",
  },
  durationText: {
    color: Colors.textMuted,
    fontSize: "13@ms",
  },
  playIcon: {
    marginLeft: "4@s",
  },
});

export default CategoryScreen;