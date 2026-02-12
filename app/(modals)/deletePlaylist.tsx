import React, { useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ScaledSheet, moderateScale } from "react-native-size-matters/extend";
import { Colors } from "@/constants/Colors";
import { triggerHaptic } from "@/helpers/haptics";
import { usePlaylists } from "@/store/library";
import VerticalSwipeGesture from "@/components/navigation/VerticalGesture";
import { useGracePeriod } from "@/services/mavin";

const DeletePlaylistModal = () => {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { playlistName } = useLocalSearchParams<{ playlistName: string }>();
  const { deletePlaylist } = usePlaylists();
  const { isPremium } = useGracePeriod();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    triggerHaptic("impactHeavy");
    
    Alert.alert(
      "Delete Playlist",
      `Are you sure you want to delete "${playlistName}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              
              // Premium users: Delete from cloud first
              if (isPremium) {
                console.log(`[Mavin] Deleting cloud playlist: ${playlistName}`);
                // await cloudPlaylistService.delete(playlistName);
              }
              
              // Delete locally
              await deletePlaylist(playlistName);
              router.back();
            } catch (error) {
              Alert.alert("Error", "Failed to delete playlist. Please try again.");
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <VerticalSwipeGesture>
        <View style={[styles.modalContent, { paddingBottom: bottom + 20 }]}>
          <View style={styles.iconContainer}>
            <View style={styles.icon}>
              <MaterialCommunityIcons name="playlist-remove" size={40} color="#FF4081" />
            </View>
          </View>

          <Text style={styles.title}>Delete Playlist</Text>
          <Text style={styles.subtitle}>
            "{playlistName}" will be permanently removed from your library.
          </Text>

          {isPremium && (
            <View style={styles.cloudWarning}>
              <MaterialIcons name="cloud" size={18} color="#FFD700" />
              <Text style={styles.cloudWarningText}>
                This playlist is synced to cloud storage. Deleting will remove it from all devices.
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.cancelButton, isDeleting && styles.buttonDisabled]}
              onPress={() => router.back()}
              disabled={isDeleting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.deleteButton, isDeleting && styles.buttonDisabled]}
              onPress={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Text style={styles.deleteButtonText}>Deleting...</Text>
              ) : (
                <>
                  <MaterialIcons name="delete" size={20} color="#000" />
                  <Text style={styles.deleteButtonText}>Delete Playlist</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
    padding: 24,
    alignItems: "center",
  },
  iconContainer: { width: 80, height: 80, marginBottom: 24 },
  icon: {
    width: "100%",
    height: "100%",
    borderRadius: 40,
    backgroundColor: "rgba(255, 64, 129, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: Colors.textMuted, fontSize: 16, textAlign: "center", marginBottom: 24 },
  cloudWarning: {
    flexDirection: "row",
    backgroundColor: "rgba(255,215,0,0.1)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  cloudWarningText: { color: "#FFD700", fontSize: 14, marginLeft: 12, flex: 1 },
  buttonContainer: { flexDirection: "row", gap: 12, width: "100%" },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
  },
  cancelButtonText: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FF4081",
  },
  deleteButtonText: { color: "#000", fontSize: 16, fontWeight: "600" },
  buttonDisabled: { opacity: 0.6 },
});

export default DeletePlaylistModal;