/**
 * Custom hook for extracting prominent colors from an image.
 * Handles:
 * - Remote URLs
 * - Local file URIs
 * - Null / undefined values safely
 * - Base64 conversion errors
 */

import { Colors } from "@/constants/Colors";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useState } from "react";
import { getColors } from "react-native-image-colors";
import { AndroidImageColors } from "react-native-image-colors/build/types";

/**
 * Converts a local image file to a Base64 encoded string.
 */
const convertImageToBase64 = async (imageUri: string) => {
  try {
    const extensionMatch = imageUri.split(".").pop()?.toLowerCase();
    let extension = extensionMatch || "jpeg";

    if (extension === "jpg") {
      extension = "jpeg";
    }

    const base64code = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return `data:image/${extension};base64,${base64code}`;
  } catch (error) {
    console.error("Error converting image to Base64:", error);
    return null;
  }
};

/**
 * Hook: useImageColors
 */
export const useImageColors = (imageUrl?: string | null) => {
  const [imageColors, setImageColors] =
    useState<AndroidImageColors | null>(null);

  useEffect(() => {
    const fetchColors = async () => {
      try {
        // 🛑 SAFETY GUARD 1 — Null or undefined
        if (!imageUrl || typeof imageUrl !== "string") {
          setImageColors(null);
          return;
        }

        // 🛑 SAFETY GUARD 2 — Empty string
        if (imageUrl.trim().length === 0) {
          setImageColors(null);
          return;
        }

        let source: string | null = imageUrl;

        // Handle local files
        if (imageUrl.startsWith("file:///")) {
          source = await convertImageToBase64(imageUrl);

          if (!source) {
            setImageColors(null);
            return;
          }
        }

        const colors = await getColors(source, {
          fallback: Colors.background,
          cache: true,
          key: imageUrl,
        });

        setImageColors(colors as AndroidImageColors);
      } catch (error) {
        console.error("Failed to get image colors:", error);
        setImageColors(null);
      }
    };

    fetchColors();
  }, [imageUrl]);

  return { imageColors };
};
