/**
 * Mavins Player - Premium Gold Edition
 * Updated with proper navbar sizing
 */
import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  RefreshControl,
  StyleSheet,
  Dimensions,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { triggerHaptic } from "@/helpers/haptics";
import ScrollControllerWrapper from "@/components/ScrollControllerWrapper";

const { width } = Dimensions.get('window');

// Metallic Gold Color Palette - Premium Luxury Edition
const COLORS = {
  // Backgrounds (Unchanged from YTM)
  background: '#000000',
  surface: '#121212',
  surfaceLight: '#1F1F1F',
  surfaceDark: '#0A0A0A',
  
  // Metallic Gold Accents
  goldPrimary: '#D4AF37', // Primary metallic gold
  goldShiny: '#FFD700', // Bright shiny gold
  goldRich: '#BF9B30', // Deeper rich gold
  goldShimmer: '#E6C16A', // Gold shimmer/highlight
  goldBronze: '#8C6F0E', // Dark gold/bronze
  goldMuted: '#C9A96A', // Muted gold for inactive states
  
  // Text Colors
  text: '#FFFFFF',
  textSecondary: '#B3B3B3', // Artists, play counts (now with gold tint)
  textTertiary: '#808080', // Meta text
  textQuaternary: '#666666',
  
  // Borders & Dividers
  border: '#333333',
  borderLight: '#444444',
  
  // Functional Colors
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  
  // Search Bar
  searchBackground: '#1A1A1A',
  searchPlaceholder: '#666666',
  
  // Live tag color - Changed from red to blue
  liveTag: '#3B82F6', // Blue color for live tags
};

// Mock Data - Updated for new layout
const TOP_CATEGORIES = ["Hits", "Mixes", "Charts", "Genres", "Workout", "Chill", "Energize", "Feel Good", "Focus", "Party"];

const TRENDING_SONGS = [
  { id: "11", title: "Blinding Lights", artist: "The Weeknd", plays: "2.1B", duration: "3:20", thumbnail: "https://picsum.photos/200/200?random=11" },
  { id: "12", title: "Stay", artist: "The Kid LAROI, Justin Bieber", plays: "1.8B", duration: "2:21", thumbnail: "https://picsum.photos/200/200?random=12" },
  { id: "13", title: "Heat Waves", artist: "Glass Animals", plays: "1.5B", duration: "3:58", thumbnail: "https://picsum.photos/200/200?random=13" },
  { id: "14", title: "As It Was", artist: "Harry Styles", plays: "1.2B", duration: "2:47", thumbnail: "https://picsum.photos/200/200?random=14" },
  { id: "15", title: "Bad Habits", artist: "Ed Sheeran", plays: "980M", duration: "3:50", thumbnail: "https://picsum.photos/200/200?random=15" },
  { id: "16", title: "Good 4 U", artist: "Olivia Rodrigo", plays: "850M", duration: "2:58", thumbnail: "https://picsum.photos/200/200?random=16" },
];

const BIGGEST_HITS = [
  { id: "1", title: "The Hit List", artist: "Drake, Taylor Swift, The Weeknd", thumbnail: "https://picsum.photos/300/300?random=1" },
  { id: "2", title: "Global Top 50", artist: "Ed Sheeran, Olivia Rodrigo, Dua Lipa", thumbnail: "https://picsum.photos/300/300?random=2" },
  { id: "3", title: "Viral Hits", artist: "Doja Cat, Lil Nas X, Billie Eilish", thumbnail: "https://picsum.photos/300/300?random=3" },
  { id: "4", title: "New Music Friday", artist: "Harry Styles, Post Malone, SZA", thumbnail: "https://picsum.photos/300/300?random=4" },
  { id: "5", title: "Throwback Hits", artist: "Michael Jackson, Madonna, Prince", thumbnail: "https://picsum.photos/300/300?random=5" },
];

const CREATE_MIX = [
  { id: "18", title: "Chill Vibes Mix", artist: "Billie Eilish, Lana Del Rey, Frank Ocean", thumbnail: "https://picsum.photos/200/200?random=17" },
  { id: "19", title: "Workout Energy", artist: "Kanye West, Travis Scott, Megan Thee Stallion", thumbnail: "https://picsum.photos/200/200?random=18" },
  { id: "20", title: "Focus Flow", artist: "Hans Zimmer, Ludovico Einaudi, Bonobo", thumbnail: "https://picsum.photos/200/200?random=19" },
  { id: "42", title: "Party Starter", artist: "Daft Punk, David Guetta, Calvin Harris", thumbnail: "https://picsum.photos/200/200?random=42" },
];

const MUSIC_CHANNELS = [
  { id: "21", name: "Hip Hop Central", logo: "https://picsum.photos/100/100?random=20", tracks: ["Sicko Mode", "God's Plan", "Industry Baby"], plays: "1.2M" },
  { id: "22", name: "Pop Revolution", logo: "https://picsum.photos/100/100?random=21", tracks: ["Levitating", "Save Your Tears", "Shivers"], plays: "890K" },
  { id: "23", name: "Rock Legends", logo: "https://picsum.photos/100/100?random=22", tracks: ["Bohemian Rhapsody", "Stairway to Heaven", "Smells Like Teen Spirit"], plays: "540K" },
  { id: "24", name: "Afrobeat World", logo: "https://picsum.photos/100/100?random=23", tracks: ["Essence", "Peru", "Calm Down"], plays: "2.1M" },
];

const PEOPLES_CHOICE = [
  { id: "25", title: "Blinding Lights", artist: "The Weeknd", thumbnail: "https://picsum.photos/200/200?random=24" },
  { id: "26", title: "Viral Dance Hits", artist: "Various Artists", thumbnail: "https://picsum.photos/200/200?random=25" },
  { id: "27", title: "Old school Nigeria", artist: "Fela, King Sunny Ade", thumbnail: "https://picsum.photos/200/200?random=26" },
  { id: "43", title: "Summer Vibes", artist: "Calvin Harris, Kygo, Avicii", thumbnail: "https://picsum.photos/200/200?random=43" },
];

const TOP_10_MONTH = [
  { id: "44", title: "1. Flowers", artist: "Miley Cyrus", plays: "1.3B", thumbnail: "https://picsum.photos/200/200?random=44" },
  { id: "45", title: "2. Anti-Hero", artist: "Taylor Swift", plays: "1.1B", thumbnail: "https://picsum.photos/200/200?random=45" },
  { id: "46", title: "3. Kill Bill", artist: "SZA", plays: "950M", thumbnail: "https://picsum.photos/200/200?random=46" },
  { id: "47", title: "4. Creepin'", artist: "Metro Boomin, The Weeknd", plays: "890M", thumbnail: "https://picsum.photos/200/200?random=47" },
];

const MAVINS_PLAYER_BEST = [
  { id: "48", title: "Mavins Gold Mix", artist: "Curated by Mavins", thumbnail: "https://picsum.photos/300/300?random=48" },
  { id: "49", title: "Premium Selection", artist: "Mavins Player", thumbnail: "https://picsum.photos/300/300?random=49" },
  { id: "50", title: "Exclusive Tracks", artist: "Mavins Player", thumbnail: "https://picsum.photos/300/300?random=50" },
  { id: "51", title: "Editor's Choice", artist: "Mavins Team", thumbnail: "https://picsum.photos/300/300?random=51" },
];

const SPONSORED = [
  { id: "52", title: "BrandX Presents", artist: "Sponsored Mix", thumbnail: "https://picsum.photos/200/200?random=52", sponsored: true },
  { id: "53", title: "Advertorial Playlist", artist: "Brand Partner", thumbnail: "https://picsum.photos/200/200?random=53", sponsored: true },
  { id: "54", title: "Promoted Content", artist: "Sponsor Name", thumbnail: "https://picsum.photos/200/200?random=54", sponsored: true },
];

const PODCASTS = [
  { id: "55", title: "Tech Talk Daily", artist: "Technology Podcast", thumbnail: "https://picsum.photos/200/200?random=55", type: "podcast" },
  { id: "56", title: "True Crime Stories", artist: "Mystery & Crime", thumbnail: "https://picsum.photos/200/200?random=56", type: "podcast" },
  { id: "57", title: "Business Insights", artist: "Entrepreneurship", thumbnail: "https://picsum.photos/200/200?random=57", type: "podcast" },
];

const RADIO_FM = [
  { id: "58", title: "Radio Mavins FM", artist: "Live 24/7", thumbnail: "https://picsum.photos/200/200?random=58", live: true },
  { id: "59", title: "Hip Hop Radio", artist: "Live Station", thumbnail: "https://picsum.photos/200/200?random=59", live: true },
  { id: "60", title: "Chillout FM", artist: "Relaxing Beats", thumbnail: "https://picsum.photos/200/200?random=60", live: true },
];

const COVERS = [
  { id: "61", title: "Popular Covers", artist: "Best Cover Songs", thumbnail: "https://picsum.photos/200/200?random=61" },
  { id: "62", title: "Acoustic Sessions", artist: "Unplugged Covers", thumbnail: "https://picsum.photos/200/200?random=62" },
  { id: "63", title: "Viral Covers", artist: "Trending Now", thumbnail: "https://picsum.photos/200/200?random=63" },
];

const NEW_RELEASES = [
  { id: "64", title: "Just Released", artist: "Fresh This Week", thumbnail: "https://picsum.photos/200/200?random=64" },
  { id: "65", title: "New Artist Spotlight", artist: "Emerging Talent", thumbnail: "https://picsum.photos/200/200?random=65" },
  { id: "66", title: "Latest Singles", artist: "Hot New Tracks", thumbnail: "https://picsum.photos/200/200?random=66" },
];

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState("Hits");
  const [searchQuery, setSearchQuery] = useState("");
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const watermarkPulse = useRef(new Animated.Value(1)).current;

  // Start pulse animation for watermark
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(watermarkPulse, {
          toValue: 1.06,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(watermarkPulse, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  }, []);

  const handleItemPress = (item: any) => {
    triggerHaptic();
    console.log('Pressed:', item.title || item.name);
  };

  const handleSearchPress = () => {
    triggerHaptic();
    router.navigate('/search');
  };

  // Combined Header Component (Search Bar + Categories)
  const CombinedHeader = () => (
    <View style={{ backgroundColor: COLORS.background }}>
      {/* Search Bar with more bottom margin to lift it up */}
      <View style={[styles.header, { paddingTop: top }]}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={COLORS.goldShimmer} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search music, artists, albums..."
            placeholderTextColor={COLORS.searchPlaceholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
        </View>
        
        {/* Right Icons */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic();
              console.log('Notifications pressed');
            }}
            style={styles.iconButton}
            hitSlop={12}
          >
            <Ionicons name="notifications-outline" size={24} color={COLORS.goldShimmer} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              triggerHaptic();
              router.navigate('/settings');
            }}
            style={styles.iconButton}
            hitSlop={12}
          >
            <Ionicons name="settings-outline" size={24} color={COLORS.goldShimmer} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Top Categories with more vertical padding */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
        >
          {TOP_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryButton,
                selectedTab === category && styles.categoryButtonActive
              ]}
              onPress={() => {
                triggerHaptic();
                setSelectedTab(category);
              }}
            >
              <Text style={[
                styles.categoryText,
                selectedTab === category && styles.categoryTextActive
              ]}>
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  // Section Header Component
  const SectionHeader = ({ title, showPlayAll = false }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {showPlayAll && (
        <TouchableOpacity style={styles.playAllButton}>
          <Text style={styles.playAllText}>Play all</Text>
          <Ionicons name="play" size={14} color={COLORS.goldPrimary} />
        </TouchableOpacity>
      )}
    </View>
  );

  // Create Mix Circle Button Component
  const CreateMixButton = () => (
    <View style={styles.createMixContainer}>
      <TouchableOpacity style={styles.createMixCircleButton} onPress={() => console.log('Create Mix pressed')}>
        <Ionicons name="add" size={28} color={COLORS.goldShiny} />
      </TouchableOpacity>
      <Text style={styles.createMixLabel}>Create Mix</Text>
    </View>
  );

  // Trending Song Row Component with Gold Accents
  const TrendingSongRow = ({ item, index }: any) => (
    <TouchableOpacity
      style={styles.trendingRow}
      onPress={() => handleItemPress(item)}
    >
      <View style={styles.trendingRowLeft}>
        <Image
          source={{ uri: item.thumbnail }}
          style={styles.trendingThumbnail}
        />
        <View style={styles.trendingInfo}>
          <Text style={styles.trendingSongTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trendingSongArtist} numberOfLines={1}>
            {item.artist}
          </Text>
          <Text style={styles.trendingSongPlays}>{item.plays} plays</Text>
        </View>
      </View>
      <View style={styles.trendingRowRight}>
        <Text style={styles.trendingDuration}>{item.duration}</Text>
        <TouchableOpacity style={styles.trendingMenuButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.goldShimmer} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Album Card Component (Also used for Biggest Hits now)
  const AlbumCard = ({ item, showPlayButton = true }: any) => (
    <TouchableOpacity
      style={styles.albumCard}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: item.thumbnail }}
        style={styles.albumImage}
      />
      {/* Netflix-style text overlay on image */}
      <View style={styles.albumTextOverlay}>
        <View style={styles.albumTextContainer}>
          <Text style={styles.albumTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.albumArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        </View>
      </View>
      
      {/* Metallic Play Button - Top Right */}
      {showPlayButton && (
        <View style={styles.albumPlayButtonContainerTopRight}>
          <TouchableOpacity style={styles.metallicPlayButtonOutline}>
            <Ionicons name="play" size={14} color={COLORS.goldShiny} />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  // Mix Card Component
  const MixCard = ({ item }: any) => (
    <TouchableOpacity
      style={styles.mixCard}
      onPress={() => handleItemPress(item)}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: item.thumbnail }}
        style={styles.mixCardImage}
      />
      {/* Play button top right */}
      <View style={styles.mixCardPlayButtonContainer}>
        <TouchableOpacity style={styles.metallicPlayButtonOutline}>
          <Ionicons name="play" size={12} color={COLORS.goldShiny} />
        </TouchableOpacity>
      </View>
      <View style={styles.mixCardOverlay}>
        <Text style={styles.mixCardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.mixCardArtist} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Music Channel Card Component
  const MusicChannelCard = ({ item }: any) => (
    <TouchableOpacity
      style={styles.channelCard}
      onPress={() => handleItemPress(item)}
    >
      <View style={styles.channelHeader}>
        <View style={styles.channelLogoContainer}>
          <Image
            source={{ uri: item.logo }}
            style={styles.channelLogo}
          />
          <View style={styles.channelLogoBorder} />
        </View>
        <View style={styles.channelInfo}>
          <Text style={styles.channelName}>{item.name}</Text>
          <Text style={styles.channelPlays}>{item.plays} plays</Text>
        </View>
      </View>
      <View style={styles.channelTracks}>
        {item.tracks.map((track: string, idx: number) => (
          <View key={idx} style={styles.channelTrackRow}>
            <Text style={styles.channelTrackNumber}>{idx + 1}</Text>
            <Text style={styles.channelTrack} numberOfLines={1}>
              {track}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

  // Top 10 Month Row Component
  const Top10MonthRow = ({ item }: any) => (
    <TouchableOpacity
      style={styles.top10Row}
      onPress={() => handleItemPress(item)}
    >
      <Text style={styles.top10Rank}>{item.title.split('.')[0]}</Text>
      <Image
        source={{ uri: item.thumbnail }}
        style={styles.top10Thumbnail}
      />
      <View style={styles.top10Info}>
        <Text style={styles.top10Title} numberOfLines={1}>
          {item.title.split('. ')[1]}
        </Text>
        <Text style={styles.top10Artist} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
      <View style={styles.top10Right}>
        <Text style={styles.top10Plays}>{item.plays}</Text>
        <TouchableOpacity style={styles.trendingMenuButton}>
          <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.goldShimmer} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Sponsored Badge Component
  const SponsoredBadge = () => (
    <View style={styles.sponsoredBadge}>
      <Text style={styles.sponsoredText}>Sponsored</Text>
    </View>
  );

  // Podcast Card Component
  const PodcastCard = ({ item }: any) => (
    <TouchableOpacity
      style={styles.podcastCard}
      onPress={() => handleItemPress(item)}
    >
      <Image
        source={{ uri: item.thumbnail }}
        style={styles.podcastImage}
      />
      <View style={styles.podcastBadge}>
        <Text style={styles.podcastBadgeText}>PODCAST</Text>
      </View>
      <View style={styles.podcastInfo}>
        <Text style={styles.podcastTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.podcastArtist} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Radio FM Card Component
  const RadioFMCard = ({ item }: any) => (
    <TouchableOpacity
      style={styles.radioCard}
      onPress={() => handleItemPress(item)}
    >
      <Image
        source={{ uri: item.thumbnail }}
        style={styles.radioImage}
      />
      <View style={styles.radioBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.radioBadgeText}>LIVE</Text>
      </View>
      <View style={styles.radioInfo}>
        <Text style={styles.radioTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.radioArtist} numberOfLines={1}>
          {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Refresh Control Component for ScrollControllerWrapper
  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[COLORS.goldPrimary]}
      tintColor={COLORS.goldPrimary}
    />
  );

  return (
    <View style={styles.container}>
      {/* WATERMARK */}
      <Animated.View pointerEvents="none" style={styles.watermarkWrapper}>
        <Animated.Image
          source={require("@/assets/images/mavins.png")}
          style={[styles.watermark, { transform: [{ scale: watermarkPulse }] }]}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ScrollControllerWrapper with combined header */}
      <ScrollControllerWrapper
        headerComponent={<CombinedHeader />}
        showHeader={true}
        refreshControl={refreshControl}
        contentContainerStyle={[
          styles.scrollContent,
        ]}
      >
        {/* SECTION 1: Trending Songs */}
        <View style={styles.section}>
          <SectionHeader
            title="Trending Now"
            showPlayAll={true}
          />
          <View style={styles.verticalList}>
            {TRENDING_SONGS.map((item, index) => (
              <TrendingSongRow key={item.id} item={item} index={index} />
            ))}
          </View>
        </View>

        {/* SECTION 2: Biggest Hits */}
        <View style={styles.section}>
          <SectionHeader
            title="Biggest Hits"
            showPlayAll={true}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {BIGGEST_HITS.map((item) => (
              <AlbumCard key={item.id} item={item} showPlayButton={true} />
            ))}
          </ScrollView>
        </View>

        {/* SECTION 3: Create Mix */}
        <View style={styles.section}>
          <SectionHeader title="Create Mix" />
          <View style={styles.createMixSection}>
            <CreateMixButton />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            >
              {CREATE_MIX.map((item) => (
                <MixCard key={item.id} item={item} />
              ))}
            </ScrollView>
          </View>
        </View>

        {/* SECTION 4: Music Channels */}
        <View style={styles.section}>
          <SectionHeader
            title="Music Channels"
            showPlayAll={true}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {MUSIC_CHANNELS.map((item) => (
              <MusicChannelCard key={item.id} item={item} />
            ))}
          </ScrollView>
        </View>

        {/* SECTION 5: People's Choice */}
        <View style={styles.section}>
          <SectionHeader
            title="People's Choice"
            showPlayAll={true}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {PEOPLES_CHOICE.map((item) => (
              <AlbumCard key={item.id} item={item} showPlayButton={false} />
            ))}
          </ScrollView>
        </View>

        {/* SECTION 6: Top 10 for the Month */}
        <View style={styles.section}>
          <SectionHeader
            title="Top 10 for the Month"
            showPlayAll={true}
          />
          <View style={styles.verticalList}>
            {TOP_10_MONTH.map((item) => (
              <Top10MonthRow key={item.id} item={item} />
            ))}
          </View>
        </View>

        {/* SECTION 7: Mavins Player Best */}
        <View style={styles.section}>
          <SectionHeader
            title="Mavins Player Best"
            showPlayAll={true}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {MAVINS_PLAYER_BEST.map((item) => (
              <AlbumCard key={item.id} item={item} showPlayButton={true} />
            ))}
          </ScrollView>
        </View>

        {/* SECTION 8: Sponsored */}
        <View style={styles.section}>
          <SectionHeader title="Sponsored" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {SPONSORED.map((item) => (
              <View key={item.id} style={styles.sponsoredCard}>
                <AlbumCard item={item} showPlayButton={false} />
                <SponsoredBadge />
              </View>
            ))}
          </ScrollView>
        </View>

        {/* SECTION 9: Podcast */}
        <View style={styles.section}>
          <SectionHeader title="Podcast" showPlayAll={true} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {PODCASTS.map((item) => (
              <PodcastCard key={item.id} item={item} />
            ))}
          </ScrollView>
        </View>

        {/* SECTION 10: Radio FM */}
        <View style={styles.section}>
          <SectionHeader title="Radio FM" showPlayAll={true} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {RADIO_FM.map((item) => (
              <RadioFMCard key={item.id} item={item} />
            ))}
          </ScrollView>
        </View>

        {/* SECTION 11: Covers */}
        <View style={styles.section}>
          <SectionHeader title="Covers" showPlayAll={true} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {COVERS.map((item) => (
              <MixCard key={item.id} item={item} />
            ))}
          </ScrollView>
        </View>

        {/* SECTION 12: New */}
        <View style={styles.section}>
          <SectionHeader title="New" showPlayAll={true} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {NEW_RELEASES.map((item) => (
              <MixCard key={item.id} item={item} />
            ))}
          </ScrollView>
        </View>

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollControllerWrapper>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  watermarkWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  watermark: {
    width: 300,
    height: 300,
    opacity: 0.08,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10, // Increased from 8 to lift content up
    backgroundColor: COLORS.background,
    
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBackground,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12, // Increased from 10
    marginRight: 16,
    borderWidth: 1,
    borderColor: COLORS.goldPrimary + '40',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    padding: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 4,
  },
  categoriesContainer: {
    backgroundColor: COLORS.background,
    paddingVertical: 12, // Increased from 8
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  categoriesScrollContent: {
    paddingHorizontal: 16,
  },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10, // Increased from 8
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: COLORS.surface,
    minHeight: 40, // Increased from 36
  },
  categoryButtonActive: {
    backgroundColor: `${COLORS.goldPrimary}20`,
    borderWidth: 1,
    borderColor: COLORS.goldPrimary,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textTertiary,
  },
  categoryTextActive: {
    color: COLORS.goldPrimary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
    // REMOVED: paddingTop - ScrollControllerWrapper handles this
    zIndex: 10,
  },
  section: {
    marginBottom: 20,
    zIndex: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.goldPrimary,
  },
  playAllText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.goldPrimary,
    marginRight: 4,
  },
  horizontalScroll: {
    paddingRight: 16,
    gap: 14,
  },
  verticalList: {
    gap: 10,
  },
  // Create Mix Button
  createMixContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  createMixCircleButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.goldShiny,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.goldShiny,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  createMixLabel: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 6,
    textAlign: 'center',
  },
  createMixSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // Trending Songs with Gold Accents
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trendingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  trendingThumbnail: {
    width: 46,
    height: 46,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceLight,
  },
  trendingInfo: {
    flex: 1,
    marginLeft: 10,
    maxWidth: '70%',
  },
  trendingSongTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  trendingSongArtist: {
    fontSize: 12,
    color: COLORS.goldShimmer,
    marginBottom: 2,
  },
  trendingSongPlays: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  trendingRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trendingDuration: {
    fontSize: 10,
    color: COLORS.goldMuted,
  },
  trendingMenuButton: {
    padding: 3,
  },
  // Album Cards
  albumCard: {
    width: 130,
    height: 170,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  albumImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceLight,
  },
  albumTextOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  albumTextContainer: {
    maxWidth: '85%',
  },
  albumTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  albumArtist: {
    fontSize: 12,
    color: COLORS.goldShimmer,
  },
  albumPlayButtonContainerTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  metallicPlayButtonOutline: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.goldShiny,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.goldShiny,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 3,
  },
  // Mix Cards
  mixCard: {
    width: 150,
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  mixCardImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceLight,
  },
  mixCardPlayButtonContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  mixCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  mixCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  mixCardArtist: {
    fontSize: 12,
    color: COLORS.goldShimmer,
  },
  // Music Channel Cards
  channelCard: {
    width: 210,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  channelLogoContainer: {
    position: 'relative',
  },
  channelLogo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.surfaceLight,
  },
  channelLogoBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: COLORS.goldPrimary,
  },
  channelInfo: {
    flex: 1,
    marginLeft: 10,
  },
  channelName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  channelPlays: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  channelTracks: {
    gap: 4,
  },
  channelTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channelTrackNumber: {
    fontSize: 10,
    color: COLORS.goldPrimary,
    width: 14,
    textAlign: 'center',
  },
  channelTrack: {
    fontSize: 11,
    color: COLORS.textQuaternary,
    flex: 1,
  },
  // Top 10 Month
  top10Row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  top10Rank: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.goldPrimary,
    width: 26,
    textAlign: 'center',
  },
  top10Thumbnail: {
    width: 46,
    height: 46,
    borderRadius: 6,
    marginLeft: 10,
    backgroundColor: COLORS.surfaceLight,
  },
  top10Info: {
    flex: 1,
    marginLeft: 10,
  },
  top10Title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  top10Artist: {
    fontSize: 12,
    color: COLORS.goldShimmer,
  },
  top10Right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  top10Plays: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  // Sponsored
  sponsoredCard: {
    position: 'relative',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: COLORS.goldPrimary + 'DD',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 2,
  },
  sponsoredText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.background,
  },
  // Podcast Cards
  podcastCard: {
    width: 130,
    height: 170,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  podcastImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceLight,
  },
  podcastBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: COLORS.success,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  podcastBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.background,
  },
  podcastInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  podcastTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  podcastArtist: {
    fontSize: 12,
    color: COLORS.goldShimmer,
  },
  // Radio FM Cards
  radioCard: {
    width: 130,
    height: 170,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  radioImage: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.surfaceLight,
  },
  radioBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: COLORS.liveTag, // Changed from red to blue
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.background,
  },
  radioBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.background,
  },
  radioInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  radioTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  radioArtist: {
    fontSize: 12,
    color: COLORS.goldShimmer,
  },
  bottomSpacing: {
    height: 60,
  },
});