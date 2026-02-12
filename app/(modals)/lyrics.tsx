import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { ScaledSheet, moderateScale } from "react-native-size-matters/extend";
import { Colors } from "@/constants/Colors";
import { triggerHaptic } from "@/helpers/haptics";
import VerticalSwipeGesture from "@/components/navigation/VerticalGesture";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { errorFromUnknown, logError } from "@/services/mavin";

// ZOD VALIDATION FOR LYRICS
const LyricsSchema = z.object({
  lyrics: z.string(),
  source: z.string(),
  synced: z.boolean().optional(),
});

type LyricsData = z.infer<typeof LyricsSchema>;

// LYRICS FETCHING FUNCTION (replace with actual API call)
const fetchLyrics = async (artist: string, title: string): Promise<LyricsData> => {
  // In production: Call Genius API or similar
  // Mock implementation for now
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        lyrics: `[Verse 1]\nCity boys dey waka for Lagos\nMoney no get enemy, I dey count am for my Lagos\n\n[Chorus]\nCity boys, city girls\nEverybody dey waka for Lagos\nMoney no get enemy\nI dey count am for my Lagos\n\n[Verse 2]\n... (full lyrics would appear here)`,
        source: "Genius",
        synced: false,
      });
    }, 800);
  });
};

const LyricsModal = () => {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  
  // Get current track from context (simplified - implement actual track context)
  const currentTrack = {
    artist: "Burna Boy",
    title: "City Boys",
    thumbnail: "https://i.scdn.co/image/ab67616d0000b273c5716278abba6a103ad28f06",
  };

  // TANSTACK QUERY FOR LYRICS
  const { data, isLoading, error, refetch } = useQuery<LyricsData>({
    queryKey: ['lyrics', currentTrack.artist, currentTrack.title],
    queryFn: () => fetchLyrics(currentTrack.artist, currentTrack.title),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
    onError: (err) => {
      const mavinError = errorFromUnknown(err);
      logError(mavinError, 'warn');
    },
  });

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <VerticalSwipeGesture>
        <View style={[styles.modalContent, { paddingBottom: bottom + 20 }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <MaterialIcons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.title}>{currentTrack.title}</Text>
              <Text style={styles.artist}>{currentTrack.artist}</Text>
            </View>
            <TouchableOpacity onPress={() => triggerHaptic("light")}>
              <MaterialIcons name="more-vert" size={28} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {/* Lyrics Content */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.loadingText}>Loading lyrics...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.errorText}>Lyrics not available for this song</Text>
              <Text style={styles.errorSubtext}>Lyrics provided by {data?.source || "Genius"}</Text>
            </View>
          ) : (
            <ScrollView
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={Colors.primary}
                  titleColor={Colors.primary}
                />
              }
              contentContainerStyle={styles.lyricsContainer}
            >
              <Text style={styles.lyricsText}>{data?.lyrics}</Text>
              <Text style={styles.sourceText}>Lyrics provided by {data?.source}</Text>
            </ScrollView>
          )}
        </View>
      </VerticalSwipeGesture>
    </View>
  );
};

const styles = ScaledSheet.create({
  container: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  modalContent: {
    backgroundColor: "#151515",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  headerText: { flex: 1, alignItems: "center" },
  title: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  artist: { color: Colors.textMuted, fontSize: 14, marginTop: 4 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  loadingText: { color: Colors.textMuted, fontSize: 16, marginTop: 16 },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  errorText: { color: Colors.textMuted, fontSize: 16, marginTop: 16, textAlign: "center" },
  errorSubtext: { color: Colors.textMuted, fontSize: 12, marginTop: 8 },
  lyricsContainer: { paddingVertical: 24 },
  lyricsText: { color: Colors.text, fontSize: 18, lineHeight: 28, textAlign: "center" },
  sourceText: { color: Colors.textMuted, fontSize: 12, marginTop: 24, textAlign: "center" },
});

export default LyricsModal;