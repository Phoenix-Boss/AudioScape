import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { ScaledSheet, moderateScale } from "react-native-size-matters/extend";
import { Colors } from "@/constants/Colors";
import { defaultStyles } from "@/styles";
import { triggerHaptic } from "@/helpers/haptics";
import { usePlaylists } from "@/store/library";
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { useMavinEngine } from "@/services/mavin/core/Engine";

// ============================================================================
// LIBRARY SCREEN
// ============================================================================
const LibraryScreen = () => {
  const router = useRouter();
  const { playlists, downloadedSongs } = usePlaylists();
  const { gracePeriodStatus, isPremium, daysRemaining } = useGracePeriod();
  const engine = useMavinEngine();
  const [refreshing, setRefreshing] = React.useState(false);

  // ============================================================================
  // HANDLE PLAY (Offline Support)
  // ============================================================================
  const handlePlay = useCallback((songId: string) => {
    triggerHaptic("light");
    
    // Check if song is downloaded (offline playback)
    const isDownloaded = downloadedSongs.some(s => s.id === songId);
    
    if (isDownloaded && gracePeriodStatus !== 'grace_period' && !isPremium) {
      // Free users: Show ad before offline playback (optional)
      // For now: Allow offline playback without ad (premium feature)
    }
    
    // Dispatch play action
    engine.dispatch({
      type: 'PLAY',
      trackId: songId,
      videoId: songId, // In production: Use actual videoId
      position: 0,
    });
    
    router.push('/(player)');
  }, [engine, router, downloadedSongs, gracePeriodStatus, isPremium]);

  // ============================================================================
  // HANDLE REFRESH
  // ============================================================================
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // In production: Refresh playlists and downloaded songs
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // ============================================================================
  // LIBRARY SECTIONS
  // ============================================================================
  const sections = [
    {
      title: "Downloaded Songs",
       downloadedSongs,
      icon: "download",
      onPress: () => router.push('/downloads'),
      emptyText: "No downloaded songs yet",
    },
    {
      title: "My Playlists",
       Object.entries(playlists).map(([name, songs]) => ({ name, songCount: songs.length })),
      icon: "playlist",
      onPress: () => router.push('/playlists'),
      emptyText: "Create your first playlist",
    },
    {
      title: "Liked Songs",
       [], // In production: Fetch from engagement engine
      icon: "heart",
      onPress: () => router.push('/likes'),
      emptyText: "No liked songs yet",
    },
  ];

  // ============================================================================
  // RENDER SECTION
  // ============================================================================
  const renderSection = ({ item }: { item: typeof sections[0] }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleContainer}>
          <Ionicons 
            name={item.icon as any} 
            size={moderateScale(20)} 
            color={Colors.primary} 
          />
          <Text style={styles.sectionTitle}>{item.title}</Text>
        </View>
        <TouchableOpacity onPress={item.onPress}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      
      {item.data.length > 0 ? (
        <FlatList
          data={item.data}
          keyExtractor={(_, index) => index.toString()}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionList}
          renderItem={({ item: sectionItem, index }) => (
            <TouchableOpacity 
              style={styles.sectionItem} 
              onPress={() => handlePlay(sectionItem.id || sectionItem.name)}
              activeOpacity={0.85}
            >
              <View style={styles.sectionItemContent}>
                <View style={styles.sectionItemIcon}>
                  <Ionicons 
                    name={item.icon as any} 
                    size={moderateScale(24)} 
                    color={Colors.primary} 
                  />
                </View>
                <Text style={styles.sectionItemTitle} numberOfLines={1}>
                  {sectionItem.title || sectionItem.name}
                </Text>
                {sectionItem.songCount && (
                  <Text style={styles.sectionItemSubtitle}>
                    {sectionItem.songCount} songs
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
        />
      ) : (
        <View style={styles.emptySection}>
          <MaterialIcons name="queue-music" size={moderateScale(48)} color={Colors.textMuted} />
          <Text style={styles.emptySectionText}>{item.emptyText}</Text>
        </View>
      )}
    </View>
  );

  // ============================================================================
  // UI RENDER
  // ============================================================================
  return (
    <SafeAreaView style={[defaultStyles.container, styles.container]}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            titleColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.username}>Your Library</Text>
          </View>
          
          <TouchableOpacity 
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Ionicons name="settings" size={moderateScale(24)} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* GRACE PERIOD BADGE */}
        {(gracePeriodStatus === 'grace_period' || isPremium) && (
          <View style={styles.graceContainer}>
            <View style={styles.graceBadge}>
              <Ionicons name="shield-checkmark" size={moderateScale(16)} color="#00FF00" />
              <Text style={styles.graceBadgeText}>
                {isPremium ? 'Premium Member' : `${daysRemaining}d left • Ad-free`}
              </Text>
            </View>
            {!isPremium && (
              <TouchableOpacity 
                style={styles.upgradeButton}
                onPress={() => router.push('/(modals)/premium')}
              >
                <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                <Ionicons name="sparkles" size={moderateScale(14)} color="#000" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* LIBRARY SECTIONS */}
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          renderItem={renderSection}
          contentContainerStyle={styles.sectionsContainer}
          showsVerticalScrollIndicator={false}
        />
      </ScrollView>
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
  scrollContent: {
    paddingBottom: "40@vs",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: "20@s",
    paddingVertical: "24@vs",
  },
  greeting: {
    color: Colors.textMuted,
    fontSize: "16@ms",
  },
  username: {
    color: Colors.text,
    fontSize: "28@ms",
    fontWeight: "700",
    marginTop: "4@vs",
  },
  settingsButton: {
    width: "44@s",
    height: "44@s",
    borderRadius: "22@s",
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  graceContainer: {
    backgroundColor: "rgba(0, 255, 0, 0.05)",
    borderRadius: "16@s",
    marginHorizontal: "20@s",
    padding: "16@s",
    marginBottom: "24@vs",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 0, 0.2)",
  },
  graceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: "8@s",
    marginBottom: "12@vs",
  },
  graceBadgeText: {
    color: "#00FF00",
    fontSize: "14@ms",
    fontWeight: "600",
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
    fontSize: "15@ms",
    fontWeight: "600",
  },
  sectionsContainer: {
    paddingBottom: "24@vs",
  },
  section: {
    marginBottom: "24@vs",
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
    gap: "10@s",
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: "20@ms",
    fontWeight: "700",
  },
  seeAll: {
    color: Colors.primary,
    fontSize: "14@ms",
    fontWeight: "600",
  },
  sectionList: {
    paddingHorizontal: "20@s",
  },
  sectionItem: {
    width: "160@s",
    marginRight: "16@s",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: "16@s",
    padding: "16@s",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  sectionItemContent: {
    alignItems: "center",
    gap: "8@vs",
  },
  sectionItemIcon: {
    width: "48@s",
    height: "48@s",
    borderRadius: "24@s",
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionItemTitle: {
    color: Colors.text,
    fontSize: "15@ms",
    fontWeight: "600",
    textAlign: "center",
  },
  sectionItemSubtitle: {
    color: Colors.textMuted,
    fontSize: "12@ms",
    textAlign: "center",
  },
  emptySection: {
    alignItems: "center",
    paddingVertical: "40@vs",
  },
  emptySectionText: {
    color: Colors.textMuted,
    fontSize: "14@ms",
    marginTop: "12@vs",
    textAlign: "center",
  },
});

export default LibraryScreen;