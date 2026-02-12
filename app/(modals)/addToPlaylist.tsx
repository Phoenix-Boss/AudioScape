import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { ScaledSheet, moderateScale } from "react-native-size-matters/extend";
import { Colors } from "@/constants/Colors";
import { triggerHaptic } from "@/helpers/haptics";
import { usePlaylists } from "@/store/library";
import VerticalSwipeGesture from "@/components/navigation/VerticalGesture";
import { useGracePeriod } from "@/services/mavin";

const AddToPlaylistModal = () => {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { track } = useLocalSearchParams<{ track?: string }>();
  const { playlists, addTrackToPlaylist, createPlaylist } = usePlaylists();
  const { isPremium } = useGracePeriod(); // Premium status for cloud sync
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const song = track ? JSON.parse(track) : null;
  
  // Filter playlists by search query
  const filteredPlaylists = Object.entries(playlists)
    .filter(([name]) => 
      name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .map(([name, songs]) => ({ name, songCount: songs.length }));

  const handleAddToPlaylist = async (playlistName: string) => {
    triggerHaptic("light");
    if (!song) return;
    
    try {
      setIsLoading(true);
      await addTrackToPlaylist(playlistName, song);
      
      // Premium users: Sync to cloud (pseudo-code - implement actual sync)
      if (isPremium) {
        console.log(`[Mavin] Syncing "${song.title}" to cloud playlist: ${playlistName}`);
        // await cloudPlaylistService.syncTrack(playlistName, song.id);
      }
      
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePlaylist = () => {
    triggerHaptic("light");
    router.push({
      pathname: "/(modals)/createPlaylist",
      params: { track: JSON.stringify(song) },
    });
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
            <Text style={styles.title}>Add to Playlist</Text>
            <View style={{ width: 28 }} />
          </View>

          {/* Search */}
          <TextInput
            style={styles.searchInput}
            placeholder="Search playlists..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Playlist List */}
          {isLoading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={filteredPlaylists}
              keyExtractor={item => item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.playlistItem}
                  onPress={() => handleAddToPlaylist(item.name)}
                >
                  <View style={styles.playlistInfo}>
                    <Text style={styles.playlistName}>{item.name}</Text>
                    <Text style={styles.playlistCount}>{item.songCount} songs</Text>
                  </View>
                  <MaterialIcons name="add" size={24} color={Colors.text} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {searchQuery ? "No playlists found" : "Create your first playlist!"}
                </Text>
              }
            />
          )}

          {/* Create Button */}
          <TouchableOpacity style={styles.createButton} onPress={handleCreatePlaylist}>
            <MaterialIcons name="add" size={24} color="#000" />
            <Text style={styles.createButtonText}>Create New Playlist</Text>
          </TouchableOpacity>
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
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 16,
  },
  title: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  searchInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 12,
    color: Colors.text,
    marginBottom: 16,
  },
  playlistItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  playlistInfo: { flex: 1 },
  playlistName: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  playlistCount: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  emptyText: { color: Colors.textMuted, textAlign: "center", paddingVertical: 40 },
  loader: { marginTop: 40 },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  createButtonText: { color: "#000", fontSize: 16, fontWeight: "600", marginLeft: 8 },
});

export default AddToPlaylistModal;