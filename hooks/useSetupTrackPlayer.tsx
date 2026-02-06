/**
 * This file contains a custom React hook for initializing and configuring the
 * `react-native-track-player`. This setup is essential for the music player to function
 * correctly and should be run once when the app starts.
 */

import { useEffect, useState } from "react";
import { initializeTrackPlayer } from "@/services/trackPlayerGlobal";

/**
 * A custom hook that initializes the `react-native-track-player` globally.
 * It ensures that the setup is only run once across the entire app.
 * @param onLoad An optional callback function to be executed when the player is successfully set up.
 */
export const useSetupTrackPlayer = ({ onLoad }: { onLoad?: () => void } = {}) => {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Skip if already ready or loading
    if (isReady || isLoading) return;

    const initPlayer = async () => {
      setIsLoading(true);
      try {
        console.log('[TrackPlayer] Hook: Starting initialization...');
        const success = await initializeTrackPlayer();
        
        if (success) {
          setIsReady(true);
          onLoad?.();
          console.log('[TrackPlayer] Hook: Initialization successful');
        } else {
          console.error('[TrackPlayer] Hook: Initialization failed');
        }
      } catch (error) {
        console.error('[TrackPlayer] Hook: Initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initPlayer();
  }, [onLoad, isReady, isLoading]);

  return { isReady, isLoading };
};