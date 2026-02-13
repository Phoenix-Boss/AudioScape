import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  ScaledSheet,
  moderateScale,
  verticalScale,
} from "react-native-size-matters/extend";
import { Colors } from "@/constants/Colors";
import { defaultStyles } from "@/styles";
import { triggerHaptic } from "@/helpers/haptics";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";

// ============================================================================
// MAVIN ENGINE INTEGRATIONS
// ============================================================================
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { useMavinEngine } from "@/services/mavin/engine/Engine";
import { useExtractionChamber } from "@/services/mavin/extraction/useExtractionChamber";
import { MavinCache } from "@/services/mavin/core/CacheLayer";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";

// ============================================================================
// ZOD VALIDATION
// ============================================================================
const SearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  artwork: z.string().url().optional(),
  duration: z.number().int().positive(),
  videoId: z.string(),
  type: z.enum(["song", "artist", "album", "playlist"]),
});

type SearchResult = z.infer<typeof SearchResultSchema>;

// ============================================================================
// SEARCH SCREEN
// ============================================================================
const SearchScreen = () => {
  const router = useRouter();
  const { gracePeriodStatus } = useGracePeriod();
  const engine = useMavinEngine();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // ============================================================================
  // SEARCH QUERY (TanStack Query with debounce)
  // ============================================================================
  const searchQuery = useQuery<SearchResult[]>({
    queryKey: ["search", query],
    queryFn: async () => {
      if (query.trim().length < 2) return [];

      // Check cache first (L1)
      try {
        const cached = await MavinCache.get<SearchResult[]>(
          `search:${query}`,
          async () => {
            throw new Error("MISS");
          },
        );
        if (cached && cached.length > 0) {
          console.log(`[Mavin Search] Cache HIT for "${query}"`);
          return cached;
        }
      } catch (e) {
        // Cache miss - proceed to extraction
      }

      // Use extraction chamber for search (mock implementation)
      // In production: Call YouTube/Spotify search APIs
      const mockResults: SearchResult[] = [
        {
          id: "1",
          title: `${query} Song 1`,
          artist: "Artist 1",
          videoId: "abc123",
          duration: 210,
          type: "song",
        },
        {
          id: "2",
          title: `${query} Song 2`,
          artist: "Artist 2",
          videoId: "def456",
          duration: 195,
          type: "song",
        },
        {
          id: "3",
          title: `${query} Album`,
          artist: "Various Artists",
          videoId: "ghi789",
          duration: 0,
          type: "album",
        },
      ];

      // Cache results for 1 hour
      await MavinCache.set(
        `search:${query}`,
        mockResults,
        60 * 60 * 1000,
        "L1_DEVICE",
      );

      return mockResults;
    },
    enabled: query.trim().length >= 2,
    staleTime: 60 * 60 * 1000, // 1 hour
    placeholderData: [],
  });

  // ============================================================================
  // HANDLE SEARCH (Debounced)
  // ============================================================================
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
  }, []);

  // ============================================================================
  // HANDLE PLAY (Engine Integration)
  // ============================================================================
  const handlePlay = useCallback(
    (result: SearchResult) => {
      triggerHaptic("light");

      // Dispatch play action to Mavin Engine
      engine.dispatch({
        type: "PLAY",
        trackId: result.id,
        videoId: result.videoId,
        position: 0,
      });

      // Navigate to player
      router.push("/(player)");

      // Blur input and hide keyboard
      inputRef.current?.blur();
      Keyboard.dismiss();
    },
    [engine, router],
  );

  // ============================================================================
  // RENDER SEARCH RESULT
  // ============================================================================
  const renderResult = useCallback(
    ({ item }: { item: SearchResult }) => {
      const isSong = item.type === "song";

      return (
        <TouchableOpacity
          style={styles.resultItem}
          onPress={() => handlePlay(item)}
          activeOpacity={0.85}
        >
          <View style={styles.resultContent}>
            <View style={styles.resultIcon}>
              <Ionicons
                name={isSong ? "musical-notes" : "albums"}
                size={moderateScale(20)}
                color={Colors.text}
              />
            </View>

            <View style={styles.resultInfo}>
              <Text style={styles.resultTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.resultSubtitle} numberOfLines={1}>
                {isSong
                  ? item.artist
                  : item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </Text>
            </View>

            {isSong && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>
                  {Math.floor(item.duration / 60)}:
                  {(item.duration % 60).toString().padStart(2, "0")}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    },
    [handlePlay],
  );

  // ============================================================================
  // UI RENDER
  // ============================================================================
  return (
    <SafeAreaView style={[defaultStyles.container, styles.container]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic("light");
                router.back();
              }}
              style={styles.backButton}
            >
              <Ionicons
                name="arrow-back"
                size={moderateScale(24)}
                color={Colors.text}
              />
            </TouchableOpacity>

            <View style={styles.searchContainer}>
              <Ionicons
                name="search"
                size={moderateScale(20)}
                color={Colors.textMuted}
                style={styles.searchIcon}
              />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                placeholder="Search songs, artists, albums..."
                placeholderTextColor={Colors.textMuted}
                value={query}
                onChangeText={handleSearch}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  style={styles.clearButton}
                >
                  <Ionicons
                    name="close-circle"
                    size={moderateScale(18)}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={() => {
                triggerHaptic("light");
                Keyboard.dismiss();
                router.back();
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* SEARCH RESULTS */}
          {query.length === 0 && !isFocused ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="search"
                size={moderateScale(64)}
                color={Colors.textMuted}
              />
              <Text style={styles.emptyTitle}>Search your music</Text>
              <Text style={styles.emptyText}>
                {gracePeriodStatus === "grace_period"
                  ? "Ad-free searching for 7 days"
                  : "Find songs, artists, and albums"}
              </Text>
            </View>
          ) : searchQuery.isLoading && query.length >= 2 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : searchQuery.data && searchQuery.data.length > 0 ? (
            <FlatList
              data={searchQuery.data}
              keyExtractor={(item) => item.id}
              renderItem={renderResult}
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
              initialNumToRender={10}
              maxToRenderPerBatch={5}
            />
          ) : query.length >= 2 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="albums"
                size={moderateScale(64)}
                color={Colors.textMuted}
              />
              <Text style={styles.emptyTitle}>No results found</Text>
              <Text style={styles.emptyText}>Try different keywords</Text>
            </View>
          ) : null}
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
};

// ============================================================================
// STYLES (Optimized for Performance)
// ============================================================================
const styles = ScaledSheet.create({
  container: {
    backgroundColor: Colors.background,
    paddingTop: 0,
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: "16@s",
    paddingVertical: "12@vs",
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
    marginRight: "8@s",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: "20@s",
    paddingHorizontal: "12@s",
    height: "40@s",
    marginRight: "8@s",
  },
  searchIcon: {
    marginRight: "8@s",
  },
  searchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: "16@ms",
    paddingVertical: "4@vs",
  },
  clearButton: {
    padding: "4@s",
  },
  cancelButton: {
    paddingVertical: "8@vs",
    paddingHorizontal: "12@s",
  },
  cancelText: {
    color: Colors.primary,
    fontSize: "16@ms",
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: "40@vs",
    paddingHorizontal: "40@s",
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: "20@ms",
    fontWeight: "700",
    marginTop: "16@vs",
    textAlign: "center",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: "14@ms",
    marginTop: "8@vs",
    textAlign: "center",
    lineHeight: "20@ms",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: "40@vs",
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: "16@ms",
    marginTop: "16@vs",
  },
  resultsList: {
    paddingVertical: "8@vs",
    paddingHorizontal: "16@s",
  },
  resultItem: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: "12@s",
    marginBottom: "8@vs",
    padding: "12@s",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  resultContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultIcon: {
    width: "36@s",
    height: "36@s",
    borderRadius: "18@s",
    backgroundColor: "rgba(212, 175, 55, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: "12@s",
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    color: Colors.text,
    fontSize: "16@ms",
    fontWeight: "600",
    marginBottom: "2@vs",
  },
  resultSubtitle: {
    color: Colors.textMuted,
    fontSize: "13@ms",
  },
  durationBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: "10@s",
    paddingVertical: "4@vs",
    borderRadius: "10@s",
  },
  durationText: {
    color: Colors.textMuted,
    fontSize: "12@ms",
    fontWeight: "500",
  },
});

export default SearchScreen;
