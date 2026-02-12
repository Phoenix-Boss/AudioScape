import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { ScaledSheet, moderateScale } from "react-native-size-matters/extend";
import { Colors } from "@/constants/Colors";
import { triggerHaptic } from "@/helpers/haptics";
import { usePlaylists } from "@/store/library";
import VerticalSwipeGesture from "@/components/navigation/VerticalGesture";
import { useGracePeriod } from "@/services/mavin";
import { z } from "zod";

// ZOD VALIDATION SCHEMA
const PlaylistSchema = z.object({
  name: z.string().min(1, "Playlist name is required").max(50, "Name too long"),
  description: z.string().max(150, "Description too long").optional(),
});

const CreatePlaylistModal = () => {
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();
  const { track } = useLocalSearchParams<{ track?: string }>();
  const { createPlaylist } = usePlaylists();
  const { isPremium } = useGracePeriod();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    triggerHaptic("light");
    
    // ZOD VALIDATION
    try {
      PlaylistSchema.parse({ name, description });
    } catch (error) {
      if (error instanceof z.ZodError) {
        Alert.alert("Validation Error", error.errors[0].message);
      }
      return;
    }

    try {
      setIsCreating(true);
      
      // Create playlist locally
      await createPlaylist(name, description || "");
      
      // Premium users: Sync to cloud (pseudo-code)
      if (isPremium) {
        console.log(`[Mavin] Creating cloud playlist: ${name}`);
        // await cloudPlaylistService.create({ name, description });
      }
      
      // Add track if provided
      if (track) {
        const song = JSON.parse(track);
        // await addTrackToPlaylist(name, song);
      }
      
      router.back();
    } catch (error) {
      Alert.alert("Error", "Failed to create playlist. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <VerticalSwipeGesture>
        <View style={[styles.modalContent, { paddingBottom: bottom + 20 }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <MaterialIcons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Create Playlist</Text>
            <TouchableOpacity disabled={isCreating} onPress={handleCreate}>
              <Text style={[styles.saveButton, isCreating && styles.saveButtonDisabled]}>
                {isCreating ? "Creating..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Playlist Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="My Awesome Playlist"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              editable={!isCreating}
            />

            <Text style={[styles.label, styles.mt16]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Optional description..."
              placeholderTextColor={Colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              editable={!isCreating}
            />

            {isPremium && (
              <View style={styles.premiumBadge}>
                <MaterialIcons name="cloud" size={16} color="#FFD700" />
                <Text style={styles.premiumText}>Cloud Sync Enabled</Text>
              </View>
            )}
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
  title: { color: Colors.text, fontSize: 20, fontWeight: "700" },
  saveButton: { color: Colors.primary, fontSize: 16, fontWeight: "600" },
  saveButtonDisabled: { color: Colors.textMuted },
  form: { marginTop: 24 },
  label: { color: Colors.text, fontSize: 14, fontWeight: "600", marginBottom: 8 },
  mt16: { marginTop: 16 },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 14,
    color: Colors.text,
    fontSize: 16,
  },
  textArea: { height: 80, paddingTop: 12, paddingBottom: 12 },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,215,0,0.1)",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  premiumText: { color: "#FFD700", fontSize: 14, marginLeft: 8, fontWeight: "500" },
});

export default CreatePlaylistModal;