// services/trackPlayerGlobal.ts
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  RepeatMode,
} from "react-native-track-player";

// Global state
let isInitialized = false;
let initializationPromise: Promise<boolean> | null = null;

/**
 * Initialize track player globally (call this only once in your app)
 */
export async function initializeTrackPlayer(): Promise<boolean> {
  // If already initialized, return immediately
  if (isInitialized) {
    console.log('[TrackPlayer] Already initialized globally');
    return true;
  }

  // If initialization is in progress, return the existing promise
  if (initializationPromise) {
    console.log('[TrackPlayer] Initialization in progress, waiting...');
    return initializationPromise;
  }

  // Create the initialization promise
  initializationPromise = (async () => {
    try {
      // Check if player is already initialized by trying to get state
      try {
        const state = await TrackPlayer.getPlaybackState();
        console.log('[TrackPlayer] Already initialized by another process, state:', state);
        isInitialized = true;
        return true;
      } catch {
        // Player not initialized, continue with setup
      }

      console.log('[TrackPlayer] Starting global initialization...');

      // Initialize the player with a max cache size.
      await TrackPlayer.setupPlayer({
        maxCacheSize: 1024 * 10, // 10 MB
      });

      // Configure the player's options.
      await TrackPlayer.updateOptions({
        android: {
          // Define the behavior when the app is killed.
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        // Define the capabilities of the player (i.e., what controls are available).
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
          Capability.SeekTo,
          Capability.JumpForward,
          Capability.JumpBackward,
        ],
        // Define the capabilities available in the notification.
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.Stop,
          Capability.SeekTo,
        ],
      });

      // Set the initial volume and repeat mode.
      await TrackPlayer.setVolume(1);
      await TrackPlayer.setRepeatMode(RepeatMode.Off);

      isInitialized = true;
      console.log('[TrackPlayer] Global initialization completed successfully');
      return true;
    } catch (error: any) {
      console.error('[TrackPlayer] Global initialization failed:', error);
      
      // If error is "already initialized", mark as initialized
      if (error?.message?.includes('already been initialized') || 
          error?.message?.includes('already initialized')) {
        console.log('[TrackPlayer] Player was already initialized (caught in error)');
        isInitialized = true;
        return true;
      }
      
      // Reset promise so we can retry
      initializationPromise = null;
      return false;
    }
  })();

  return initializationPromise;
}

/**
 * Check if player is already initialized
 */
export function isTrackPlayerInitialized(): boolean {
  return isInitialized;
}

/**
 * Reset initialization state (for testing/development only)
 */
export function resetTrackPlayerInitialization(): void {
  isInitialized = false;
  initializationPromise = null;
  console.log('[TrackPlayer] Reset initialization state');
}