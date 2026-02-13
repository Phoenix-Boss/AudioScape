/**
 * MENU MODAL — CLIENT-ONLY CONTEXT MENU
 * Reusable component architecture | Expo Image | Separated services
 * No creator analytics | No admin tools | Pure user actions
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ToastAndroid,
  Share,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Divider } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledSheet, moderateScale, scale, verticalScale } from "react-native-size-matters/extend";
import {
  Feather,
  MaterialCommunityIcons,
  MaterialIcons,
  Ionicons,
} from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { BlurView } from "expo-blur";
import Animated, { 
  FadeInDown, 
  FadeOutUp,
  SlideInDown,
  SlideOutDown 
} from "react-native-reanimated";

// ============================================================================
// LOCAL IMPORTS — Client Only
// ============================================================================
import { Colors } from "@/constants/Colors";
import { unknownTrackImageUri } from "@/constants/images";
import { triggerHaptic } from "@/helpers/haptics";
import { useMusicPlayer } from "@/components/MusicPlayerContext";
import { usePlaylists } from "@/store/library";

// ============================================================================
// MAVIN ENGINE CLIENT IMPORTS — SEPARATED SERVICES
// ============================================================================
import { useGracePeriod } from "@/services/mavin/monetization/GracePeriod";
import { useAdMonetization } from "@/services/mavin/monetization/AdMonetization";
import { useLikeSong } from "@/services/engagement/EngagementEngine";
import { useDownloads } from "@/services/mavin/download/DownloadManager";
import { errorFromUnknown, logError } from "@/services/mavin/core/errors";

// ============================================================================
// YOUTUBE SERVICE IMPORTS
// ============================================================================
import { 
  getInfo, 
  innertube, 
  processAlbumPageData, 
  processPlaylistPageData 
} from "@/services/youtube";

// ============================================================================
// TYPES
// ============================================================================
interface Song {
  id: string;
  title: string;
  artist: string;
  thumbnail?: string | null;
  duration?: number;
  url?: string;
  videoId?: string;
}

interface Playlist {
  name: string;
  thumbnail?: string | null;
  songCount?: number;
}

interface Album {
  name: string;
  id: string;
  artist: string;
  thumbnail?: string | null;
}

// ============================================================================
// REUSABLE COMPONENT: MenuHeader
// ============================================================================
interface MenuHeaderProps {
  title: string;
  artist?: string;
  thumbnail?: string | null;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  showFavorite?: boolean;
}

const MenuHeader: React.FC<MenuHeaderProps> = ({
  title,
  artist,
  thumbnail,
  isFavorite = false,
  onFavoriteToggle,
  showFavorite = false,
}) => {
  return (
    <View style={styles.menuHeaderItem}>
      <Image
        source={{ uri: thumbnail ?? unknownTrackImageUri }}
        style={styles.thumbnail}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        placeholder={require("@/assets/images/mavins.png")}
        placeholderContentFit="cover"
      />
      
      <View style={styles.menuHeaderText}>
        <Text style={styles.menuHeaderTitle} numberOfLines={1}>
          {title}
        </Text>
        {artist && (
          <Text style={styles.songArtist} numberOfLines={1}>
            {artist}
          </Text>
        )}
      </View>
      
      {showFavorite && onFavoriteToggle && (
        <TouchableOpacity
          onPress={onFavoriteToggle}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons
            name={isFavorite ? "heart" : "heart-outline"}
            size={moderateScale(24)}
            color={isFavorite ? "#FF4081" : Colors.textMuted}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================================
// REUSABLE COMPONENT: MenuItem
// ============================================================================
interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  label,
  onPress,
  destructive = false,
  disabled = false,
  loading = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.menuItem, disabled && styles.menuItemDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemIcon}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          icon
        )}
      </View>
      <Text
        style={[
          styles.menuItemText,
          destructive && styles.menuItemTextDestructive,
          disabled && styles.menuItemTextDisabled,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ============================================================================
// REUSABLE COMPONENT: DismissIndicator
// ============================================================================
const DismissIndicator = () => (
  <View style={styles.dismissIndicator}>
    <View style={styles.dismissBar} />
  </View>
);

// ============================================================================
// MENU MODAL — CLIENT-ONLY
// ============================================================================
export default function MenuModal() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  
  // ==========================================================================
  // PARSE PARAMETERS — Safe parsing with error handling
  // ==========================================================================
  const params = useLocalSearchParams<{
    songData?: string;
    type: string;
    playlistName?: string;
    playlistData?: string;
    albumData?: string;
    remotePlaylistData?: string;
  }>();

  const { type } = params;

  // Safe JSON parsers
  const selectedSong = useMemo<Song | null>(() => {
    if (!params.songData) return null;
    try {
      return JSON.parse(params.songData);
    } catch {
      return null;
    }
  }, [params.songData]);

  const selectedPlaylist = useMemo(() => {
    if (!params.playlistData) return null;
    try {
      return JSON.parse(params.playlistData);
    } catch {
      return null;
    }
  }, [params.playlistData]);

  const selectedAlbum = useMemo(() => {
    if (!params.albumData) return null;
    try {
      return JSON.parse(params.albumData);
    } catch {
      return null;
    }
  }, [params.albumData]);

  const selectedRemotePlaylist = useMemo(() => {
    if (!params.remotePlaylistData) return null;
    try {
      return JSON.parse(params.remotePlaylistData);
    } catch {
      return null;
    }
  }, [params.remotePlaylistData]);

  // ==========================================================================
  // HOOKS — Client Services (Separated)
  // ==========================================================================
  const { playNext, playAudio, playPlaylist } = useMusicPlayer();
  const { playlists, removeTrackFromPlaylist } = usePlaylists();
  
  // Mavin Engine Hooks — Separated by concern
  const { gracePeriodStatus, isPremium } = useGracePeriod();
  const { 
    shouldTriggerDownloadGate, 
    incrementDownloadQuota, 
    startAd,
    canDownload,
  } = useAdMonetization();
  
  const { mutate: likeSong, isPending: isLiking } = useLikeSong();
  const { 
    downloadSong, 
    removeDownload, 
    isDownloaded, 
    isDownloading,
    getDownloadProgress 
  } = useDownloads();

  // ==========================================================================
  // LOCAL STATE
  // ==========================================================================
  const [isFavorite, setIsFavorite] = useState(false);
  const [isDownloadingState, setIsDownloadingState] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // ==========================================================================
  // CHECK FAVORITE STATUS — Client Only
  // ==========================================================================
  useEffect(() => {
    const checkFavorite = async () => {
      if (selectedSong?.id) {
        // In production: Check from local store or cache
        // For now: Use local state
        setIsFavorite(false);
      }
    };
    checkFavorite();
  }, [selectedSong?.id]);

  // ==========================================================================
  // CHECK DOWNLOAD STATUS
  // ==========================================================================
  useEffect(() => {
    if (selectedSong?.id) {
      const downloaded = isDownloaded(selectedSong.id);
      const downloading = isDownloading(selectedSong.id);
      setIsDownloadingState(downloading);
    }
  }, [selectedSong?.id, isDownloaded, isDownloading]);

  // ==========================================================================
  // HANDLER: Like/Unlike Song
  // ==========================================================================
  const handleLike = useCallback(async () => {
    if (!selectedSong?.id) return;

    try {
      triggerHaptic("medium");
      await likeSong(selectedSong.id);
      setIsFavorite(prev => !prev);
      
      ToastAndroid.show(
        !isFavorite ? "Added to Liked Songs" : "Removed from Liked Songs",
        ToastAndroid.SHORT
      );
    } catch (error) {
      logError(errorFromUnknown(error), "warn");
      ToastAndroid.show("Failed to update like", ToastAndroid.SHORT);
    }
  }, [selectedSong?.id, likeSong, isFavorite]);

  // ==========================================================================
  // HANDLER: Download Song — With Ethical Monetization
  // ==========================================================================
  const handleDownload = useCallback(async () => {
    if (!selectedSong) return;

    try {
      triggerHaptic("light");
      setIsProcessing(true);

      // Check if already downloaded
      if (isDownloaded(selectedSong.id)) {
        ToastAndroid.show("Already downloaded", ToastAndroid.SHORT);
        return;
      }

      // Check if already downloading
      if (isDownloading(selectedSong.id)) {
        ToastAndroid.show("Download in progress", ToastAndroid.SHORT);
        return;
      }

      // FREE USERS: Show ad before download
      if (!isPremium && gracePeriodStatus !== 'grace_period') {
        if (shouldTriggerDownloadGate()) {
          const adCompleted = await startAd(
            'download_gate',
            'admob',
            'ca-app-pub-3940256099942544/1033173712',
            selectedSong.id
          );

          if (!adCompleted) {
            ToastAndroid.show("Download cancelled", ToastAndroid.SHORT);
            return;
          }

          // Reset quota after ad
          incrementDownloadQuota();
        } else {
          // Increment quota normally
          incrementDownloadQuota();
        }
      }

      // PREMIUM/GRACE: Direct download
      await downloadSong(selectedSong);
      
      ToastAndroid.show(
        isPremium || gracePeriodStatus === 'grace_period' 
          ? "Download started (Premium)" 
          : "Download started",
        ToastAndroid.SHORT
      );
      
      router.back();

    } catch (error) {
      logError(errorFromUnknown(error), "error");
      ToastAndroid.show("Download failed. Please try again.", ToastAndroid.SHORT);
    } finally {
      setIsProcessing(false);
    }
  }, [
    selectedSong,
    isPremium,
    gracePeriodStatus,
    isDownloaded,
    isDownloading,
    shouldTriggerDownloadGate,
    startAd,
    incrementDownloadQuota,
    downloadSong,
    router,
  ]);

  // ==========================================================================
  // HANDLER: Remove Downloaded Song
  // ==========================================================================
  const handleRemoveDownload = useCallback(async () => {
    if (!selectedSong?.id) return;

    Alert.alert(
      "Remove Download",
      "Remove this song from your downloads?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              triggerHaptic("medium");
              await removeDownload(selectedSong.id);
              ToastAndroid.show("Download removed", ToastAndroid.SHORT);
              router.back();
            } catch (error) {
              logError(errorFromUnknown(error), "error");
              ToastAndroid.show("Failed to remove", ToastAndroid.SHORT);
            }
          },
        },
      ]
    );
  }, [selectedSong?.id, removeDownload, router]);

  // ==========================================================================
  // HANDLER: Play Next
  // ==========================================================================
  const handlePlayNext = useCallback(async () => {
    try {
      triggerHaptic("light");
      
      if (selectedSong) {
        await playNext([selectedSong]);
        ToastAndroid.show("Song will play next", ToastAndroid.SHORT);
      } else if (selectedPlaylist) {
        const songs = playlists[selectedPlaylist.name] || [];
        if (songs.length > 0) {
          await playNext(songs);
          ToastAndroid.show("Playlist will play next", ToastAndroid.SHORT);
        }
      } else if (selectedAlbum) {
        const yt = await innertube;
        const album = await yt.music.getAlbum(selectedAlbum.id);
        const albumData = processAlbumPageData(album);
        const songs = albumData?.songs?.map(({ duration, ...rest }) => ({
          ...rest,
          artist: selectedAlbum.artist,
          thumbnail: albumData?.thumbnail ?? unknownTrackImageUri,
        })) ?? [];
        
        if (songs.length > 0) {
          await playNext(songs);
          ToastAndroid.show("Album will play next", ToastAndroid.SHORT);
        }
      } else if (selectedRemotePlaylist) {
        const yt = await innertube;
        const playlist = await yt.music.getPlaylist(selectedRemotePlaylist.id);
        const playlistData = processPlaylistPageData(playlist);
        
        if (playlistData.songs.length > 0) {
          await playNext(playlistData.songs);
          ToastAndroid.show("Playlist will play next", ToastAndroid.SHORT);
        }
      }
      
      router.back();
    } catch (error) {
      logError(errorFromUnknown(error), "warn");
      ToastAndroid.show("Failed to add to queue", ToastAndroid.SHORT);
    }
  }, [
    selectedSong,
    selectedPlaylist,
    selectedAlbum,
    selectedRemotePlaylist,
    playlists,
    playNext,
    router,
  ]);

  // ==========================================================================
  // HANDLER: Play Now
  // ==========================================================================
  const handlePlayNow = useCallback(async () => {
    try {
      triggerHaptic("light");
      
      if (selectedSong) {
        await playAudio(selectedSong);
      } else if (selectedPlaylist) {
        const songs = playlists[selectedPlaylist.name] || [];
        if (songs.length > 0) {
          await playPlaylist(songs);
        }
      } else if (selectedAlbum) {
        const yt = await innertube;
        const album = await yt.music.getAlbum(selectedAlbum.id);
        const albumData = processAlbumPageData(album);
        const songs = albumData?.songs?.map(({ duration, ...rest }) => ({
          ...rest,
          artist: selectedAlbum.artist,
          thumbnail: albumData?.thumbnail ?? unknownTrackImageUri,
        })) ?? [];
        
        if (songs.length > 0) {
          await playPlaylist(songs);
        }
      } else if (selectedRemotePlaylist) {
        const yt = await innertube;
        const playlist = await yt.music.getPlaylist(selectedRemotePlaylist.id);
        const playlistData = processPlaylistPageData(playlist);
        
        if (playlistData.songs.length > 0) {
          await playPlaylist(playlistData.songs);
        }
      }
      
      router.push('/(player)');
    } catch (error) {
      logError(errorFromUnknown(error), "warn");
      ToastAndroid.show("Failed to play", ToastAndroid.SHORT);
    }
  }, [
    selectedSong,
    selectedPlaylist,
    selectedAlbum,
    selectedRemotePlaylist,
    playlists,
    playAudio,
    playPlaylist,
    router,
  ]);

  // ==========================================================================
  // HANDLER: Remove from Playlist
  // ==========================================================================
  const handleRemoveFromPlaylist = useCallback(async () => {
    if (!selectedSong?.id || !params.playlistName) return;

    try {
      triggerHaptic("medium");
      await removeTrackFromPlaylist(selectedSong.id, params.playlistName);
      ToastAndroid.show("Removed from playlist", ToastAndroid.SHORT);
      router.back();
    } catch (error) {
      logError(errorFromUnknown(error), "error");
      ToastAndroid.show("Failed to remove", ToastAndroid.SHORT);
    }
  }, [selectedSong?.id, params.playlistName, removeTrackFromPlaylist, router]);

  // ==========================================================================
  // HANDLER: Remove from Queue
  // ==========================================================================
  const handleRemoveFromQueue = useCallback(async () => {
    if (!selectedSong?.id) return;

    try {
      triggerHaptic("medium");
      // In production: Remove from TrackPlayer queue
      ToastAndroid.show("Removed from queue", ToastAndroid.SHORT);
      router.back();
    } catch (error) {
      logError(errorFromUnknown(error), "warn");
      ToastAndroid.show("Failed to remove", ToastAndroid.SHORT);
    }
  }, [selectedSong?.id, router]);

  // ==========================================================================
  // HANDLER: Delete Playlist
  // ==========================================================================
  const handleDeletePlaylist = useCallback(() => {
    if (!selectedPlaylist?.name) return;

    triggerHaptic("light");
    router.push({
      pathname: "/(modals)/deletePlaylist",
      params: { playlistName: selectedPlaylist.name },
    });
  }, [selectedPlaylist?.name, router]);

  // ==========================================================================
  // HANDLER: Add to Playlist
  // ==========================================================================
  const handleAddToPlaylist = useCallback(() => {
    if (!selectedSong) return;

    triggerHaptic("light");
    router.push({
      pathname: "/(modals)/addToPlaylist",
      params: { track: JSON.stringify(selectedSong) },
    });
  }, [selectedSong, router]);

  // ==========================================================================
  // HANDLER: Share
  // ==========================================================================
  const handleShare = useCallback(async () => {
    if (!selectedSong?.id) return;

    try {
      triggerHaptic("light");
      
      const shareUrl = selectedSong.videoId
        ? `https://music.youtube.com/watch?v=${selectedSong.videoId}`
        : `https://music.youtube.com/watch?v=${selectedSong.id}`;

      await Share.share({
        message: `${selectedSong.title} by ${selectedSong.artist}\n${shareUrl}`,
        title: "Check out this song!",
      });
    } catch (error) {
      logError(errorFromUnknown(error), "warn");
    }
  }, [selectedSong]);

  // ==========================================================================
  // HANDLER: Start Radio
  // ==========================================================================
  const handleStartRadio = useCallback(async () => {
    if (!selectedSong?.id) return;

    try {
      triggerHaptic("light");
      ToastAndroid.show("Starting radio station...", ToastAndroid.SHORT);
      
      // In production: Create radio station from song
      await playAudio(selectedSong);
      router.push('/(player)');
      
      ToastAndroid.show(`${selectedSong.title} Radio`, ToastAndroid.SHORT);
    } catch (error) {
      logError(errorFromUnknown(error), "warn");
      ToastAndroid.show("Failed to start radio", ToastAndroid.SHORT);
    }
  }, [selectedSong, playAudio, router]);

  // ==========================================================================
  // HANDLER: Go to Artist
  // ==========================================================================
  const handleGoToArtist = useCallback(() => {
    if (!selectedSong?.artist) return;

    triggerHaptic("light");
    router.push({
      pathname: "/(artist)/[id]",
      params: { 
        id: selectedSong.artist.toLowerCase().replace(/\s+/g, '-'),
        name: selectedSong.artist 
      },
    });
  }, [selectedSong?.artist, router]);

  // ==========================================================================
  // HANDLER: Go to Album
  // ==========================================================================
  const handleGoToAlbum = useCallback(() => {
    if (!selectedAlbum?.id && !selectedSong?.album) return;

    triggerHaptic("light");
    
    if (selectedAlbum?.id) {
      router.push({
        pathname: "/(album)/[id]",
        params: { 
          id: selectedAlbum.id,
          name: selectedAlbum.name 
        },
      });
    }
  }, [selectedAlbum, selectedSong, router]);

  // ==========================================================================
  // MENU ITEMS CONFIGURATION — Client Only
  // ==========================================================================
  const menuItems = useMemo(() => {
    const items = [];

    // SONG ITEMS
    if (type.includes("song") || type.includes("queueSong") || type.includes("playlistSong") || type.includes("downloadedSong")) {
      items.push(
        {
          id: "playNow",
          icon: <Feather name="play" size={moderateScale(20)} color={Colors.text} />,
          label: "Play Now",
          onPress: handlePlayNow,
          types: ["song", "playlistSong", "queueSong", "downloadedSong"],
        },
        {
          id: "playNext",
          icon: <MaterialIcons name="playlist-play" size={moderateScale(20)} color={Colors.text} />,
          label: "Play Next",
          onPress: handlePlayNext,
          types: ["song", "playlistSong", "queueSong", "downloadedSong"],
        },
        {
          id: "addToPlaylist",
          icon: <MaterialIcons name="playlist-add" size={moderateScale(20)} color={Colors.text} />,
          label: "Add to Playlist",
          onPress: handleAddToPlaylist,
          types: ["song", "playlistSong", "queueSong"],
        },
        {
          id: "startRadio",
          icon: <Feather name="radio" size={moderateScale(20)} color={Colors.text} />,
          label: "Start Radio",
          onPress: handleStartRadio,
          types: ["song", "playlistSong", "queueSong"],
        },
        {
          id: "like",
          icon: (
            <MaterialCommunityIcons
              name={isFavorite ? "heart" : "heart-outline"}
              size={moderateScale(20)}
              color={isFavorite ? "#FF4081" : Colors.text}
            />
          ),
          label: isFavorite ? "Remove Like" : "Like",
          onPress: handleLike,
          types: ["song", "playlistSong", "queueSong", "downloadedSong"],
        },
        {
          id: "share",
          icon: <Feather name="share" size={moderateScale(20)} color={Colors.text} />,
          label: "Share",
          onPress: handleShare,
          types: ["song", "playlistSong", "queueSong", "downloadedSong"],
        },
        {
          id: "goToArtist",
          icon: <MaterialCommunityIcons name="account-music" size={moderateScale(20)} color={Colors.text} />,
          label: "Go to Artist",
          onPress: handleGoToArtist,
          types: ["song", "playlistSong", "queueSong", "downloadedSong"],
        }
      );

      // Download item (not for downloaded songs)
      if (!type.includes("downloadedSong")) {
        items.push({
          id: "download",
          icon: <MaterialIcons name="download" size={moderateScale(20)} color={Colors.text} />,
          label: isDownloadingState ? "Downloading..." : "Download",
          onPress: handleDownload,
          types: ["song", "playlistSong", "queueSong"],
          disabled: isDownloadingState || isProcessing,
          loading: isDownloadingState || isProcessing,
        });
      }

      // Remove download item (only for downloaded songs)
      if (type.includes("downloadedSong")) {
        items.push({
          id: "removeDownload",
          icon: <MaterialIcons name="delete-outline" size={moderateScale(20)} color="#FF4081" />,
          label: "Remove Download",
          onPress: handleRemoveDownload,
          types: ["downloadedSong"],
          destructive: true,
        });
      }

      // Remove from queue (only for queue songs)
      if (type.includes("queueSong")) {
        items.push({
          id: "removeFromQueue",
          icon: <MaterialIcons name="playlist-remove" size={moderateScale(20)} color="#FF4081" />,
          label: "Remove from Queue",
          onPress: handleRemoveFromQueue,
          types: ["queueSong"],
          destructive: true,
        });
      }

      // Remove from playlist (only for playlist songs)
      if (type.includes("playlistSong") && params.playlistName) {
        items.push({
          id: "removeFromPlaylist",
          icon: <MaterialIcons name="playlist-remove" size={moderateScale(20)} color="#FF4081" />,
          label: "Remove from Playlist",
          onPress: handleRemoveFromPlaylist,
          types: ["playlistSong"],
          destructive: true,
        });
      }
    }

    // PLAYLIST ITEMS
    if (type.includes("playlist")) {
      items.push(
        {
          id: "playPlaylist",
          icon: <Feather name="play" size={moderateScale(20)} color={Colors.text} />,
          label: "Play Playlist",
          onPress: handlePlayNow,
          types: ["playlist"],
        },
        {
          id: "playPlaylistNext",
          icon: <MaterialIcons name="playlist-play" size={moderateScale(20)} color={Colors.text} />,
          label: "Play Next",
          onPress: handlePlayNext,
          types: ["playlist"],
        },
        {
          id: "deletePlaylist",
          icon: <MaterialIcons name="delete-outline" size={moderateScale(20)} color="#FF4081" />,
          label: "Delete Playlist",
          onPress: handleDeletePlaylist,
          types: ["playlist"],
          destructive: true,
        }
      );
    }

    // ALBUM ITEMS
    if (type.includes("album")) {
      items.push(
        {
          id: "playAlbum",
          icon: <Feather name="play" size={moderateScale(20)} color={Colors.text} />,
          label: "Play Album",
          onPress: handlePlayNow,
          types: ["album"],
        },
        {
          id: "playAlbumNext",
          icon: <MaterialIcons name="playlist-play" size={moderateScale(20)} color={Colors.text} />,
          label: "Play Next",
          onPress: handlePlayNext,
          types: ["album"],
        }
      );
    }

    // REMOTE PLAYLIST ITEMS
    if (type.includes("remotePlaylist")) {
      items.push(
        {
          id: "playRemotePlaylist",
          icon: <Feather name="play" size={moderateScale(20)} color={Colors.text} />,
          label: "Play Playlist",
          onPress: handlePlayNow,
          types: ["remotePlaylist"],
        },
        {
          id: "playRemotePlaylistNext",
          icon: <MaterialIcons name="playlist-play" size={moderateScale(20)} color={Colors.text} />,
          label: "Play Next",
          onPress: handlePlayNext,
          types: ["remotePlaylist"],
        }
      );
    }

    return items;
  }, [
    type,
    isFavorite,
    isDownloadingState,
    isProcessing,
    params.playlistName,
    handlePlayNow,
    handlePlayNext,
    handleAddToPlaylist,
    handleStartRadio,
    handleLike,
    handleShare,
    handleGoToArtist,
    handleDownload,
    handleRemoveDownload,
    handleRemoveFromQueue,
    handleRemoveFromPlaylist,
    handleDeletePlaylist,
  ]);

  // ==========================================================================
  // FILTER ITEMS BY TYPE
  // ==========================================================================
  const filteredItems = useMemo(() => {
    return menuItems.filter(item => item.types.includes(type));
  }, [menuItems, type]);

  // ==========================================================================
  // RENDER HEADER BASED ON TYPE
  // ==========================================================================
  const renderHeader = () => {
    if (selectedSong) {
      return (
        <MenuHeader
          title={selectedSong.title}
          artist={selectedSong.artist}
          thumbnail={selectedSong.thumbnail}
          isFavorite={isFavorite}
          onFavoriteToggle={handleLike}
          showFavorite
        />
      );
    }

    if (selectedPlaylist && type === "playlist") {
      return (
        <MenuHeader
          title={selectedPlaylist.name}
          thumbnail={selectedPlaylist.thumbnail}
        />
      );
    }

    if (selectedAlbum && type === "album") {
      return (
        <MenuHeader
          title={selectedAlbum.name}
          artist={selectedAlbum.artist}
          thumbnail={selectedAlbum.thumbnail}
        />
      );
    }

    if (selectedRemotePlaylist && type === "remotePlaylist") {
      return (
        <MenuHeader
          title={selectedRemotePlaylist.name}
          artist={selectedRemotePlaylist.artist}
          thumbnail={selectedRemotePlaylist.thumbnail}
        />
      );
    }

    return null;
  };

  // ==========================================================================
  // PREMIUM BADGE (Optional)
  // ==========================================================================
  const renderPremiumBadge = () => {
    if (!(isPremium || gracePeriodStatus === 'grace_period')) return null;
    
    return (
      <View style={styles.premiumBadgeContainer}>
        <View style={styles.premiumBadge}>
          <MaterialIcons name="workspace-premium" size={moderateScale(12)} color={Colors.primary} />
          <Text style={styles.premiumBadgeText}>
            {isPremium ? 'Premium' : `${gracePeriodStatus === 'grace_period' ? 'Trial' : ''}`}
          </Text>
        </View>
      </View>
    );
  };

  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================
  return (
    <View style={styles.modalBackground}>
      <VerticalSwipeGesture duration={400}>
        <BlurView 
          intensity={90} 
          tint="dark" 
          style={[styles.modalOverlay, { paddingBottom: bottom + verticalScale(20) }]}
        >
          <View style={styles.modalContent}>
            
            {/* Dismiss Indicator */}
            <DismissIndicator />
            
            {/* Premium Badge */}
            {renderPremiumBadge()}
            
            {/* Header */}
            <View style={styles.headerContainer}>
              {renderHeader()}
            </View>

            {/* Divider */}
            <Divider style={styles.divider} />

            {/* Menu Items */}
            <View style={styles.menuItemsContainer}>
              {filteredItems.map((item, index) => (
                <React.Fragment key={item.id}>
                  <MenuItem
                    icon={item.icon}
                    label={item.label}
                    onPress={item.onPress}
                    destructive={item.destructive}
                    disabled={item.disabled}
                    loading={item.loading}
                  />
                  {index < filteredItems.length - 1 && (
                    <Divider style={styles.itemDivider} />
                  )}
                </React.Fragment>
              ))}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                triggerHaptic("light");
                router.back();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

          </View>
        </BlurView>
      </VerticalSwipeGesture>
    </View>
  );
}

// ============================================================================
// STYLES — Clean, Consistent, Reusable
// ============================================================================
const styles = ScaledSheet.create({
  modalBackground: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1A1A1A",
    borderTopLeftRadius: "20@ms",
    borderTopRightRadius: "20@ms",
    paddingTop: "16@vs",
    paddingBottom: "8@vs",
    maxHeight: "80%",
    width: "100%",
    alignSelf: "center",
  },
  dismissIndicator: {
    alignItems: "center",
    paddingVertical: "8@vs",
  },
  dismissBar: {
    width: "40@s",
    height: "4@vs",
    borderRadius: "2@s",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  premiumBadgeContainer: {
    alignItems: "center",
    marginBottom: "8@vs",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: "4@s",
    backgroundColor: "rgba(212,175,55,0.1)",
    paddingHorizontal: "10@s",
    paddingVertical: "4@vs",
    borderRadius: "12@ms",
  },
  premiumBadgeText: {
    color: Colors.primary,
    fontSize: "11@ms",
    fontWeight: "600",
  },
  headerContainer: {
    paddingHorizontal: "16@s",
    paddingVertical: "12@vs",
  },
  menuHeaderItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: "12@s",
  },
  thumbnail: {
    width: "50@s",
    height: "50@s",
    borderRadius: "8@ms",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  menuHeaderText: {
    flex: 1,
  },
  menuHeaderTitle: {
    color: Colors.text,
    fontSize: "16@ms",
    fontWeight: "600",
    marginBottom: "2@vs",
  },
  songArtist: {
    color: Colors.textMuted,
    fontSize: "13@ms",
  },
  divider: {
    backgroundColor: "rgba(255,255,255,0.1)",
    height: 1,
    marginVertical: "8@vs",
  },
  menuItemsContainer: {
    paddingHorizontal: "16@s",
    paddingVertical: "8@vs",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: "12@vs",
    paddingHorizontal: "8@s",
    borderRadius: "8@ms",
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemIcon: {
    width: "32@s",
    alignItems: "center",
  },
  menuItemText: {
    color: Colors.text,
    fontSize: "15@ms",
    marginLeft: "12@s",
    flex: 1,
  },
  menuItemTextDestructive: {
    color: "#FF4081",
  },
  menuItemTextDisabled: {
    color: "rgba(255,255,255,0.3)",
  },
  itemDivider: {
    backgroundColor: "rgba(255,255,255,0.05)",
    height: 1,
    marginLeft: "44@s",
  },
  cancelButton: {
    marginTop: "12@vs",
    marginHorizontal: "16@s",
    marginBottom: "8@vs",
    paddingVertical: "12@vs",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: "12@ms",
    alignItems: "center",
  },
  cancelButtonText: {
    color: Colors.text,
    fontSize: "16@ms",
    fontWeight: "600",
  },
});