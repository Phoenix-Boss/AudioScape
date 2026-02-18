/**
 * Safe TrackPlayer logging hook
 * Version-safe (v3 + v4)
 * Crash-proof (filters invalid events)
 * Dev-only recommended
 */

import { useEffect } from "react";
import {
  Event,
  useTrackPlayerEvents,
  usePlaybackState,
} from "react-native-track-player";

export const useLogTrackPlayerState = () => {
  /**
   * Dynamically build event list
   * This prevents undefined events from crashing Android
   */
  const safeEvents = [
    Event?.PlaybackState,
    Event?.PlaybackError,
    Event?.PlaybackTrackChanged,
    Event?.PlaybackActiveTrackChanged, // v4 only
    Event?.PlaybackQueueEnded,
    Event?.PlaybackMetadataReceived,
  ].filter(Boolean); // 🔥 THIS prevents native crash

  // Playback state logging (always safe)
  const playbackState = usePlaybackState();

  useEffect(() => {
    if (!__DEV__) return;

    console.log("[TrackPlayer] Playback state:", playbackState);
  }, [playbackState]);

  /**
   * Only register events if we actually have valid ones
   */
  if (safeEvents.length > 0) {
    useTrackPlayerEvents(safeEvents, async (event) => {
      if (!__DEV__) return;

      switch (event.type) {
        case Event?.PlaybackError:
          console.warn("[TrackPlayer] Error:", event);
          break;

        case Event?.PlaybackState:
          console.log("[TrackPlayer] State changed:", event.state);
          break;

        case Event?.PlaybackTrackChanged:
          console.log(
            "[TrackPlayer] Track changed:",
            event.prevTrack,
            "→",
            event.nextTrack
          );
          break;

        case Event?.PlaybackActiveTrackChanged:
          console.log(
            "[TrackPlayer] Active track changed:",
            event.track
          );
          break;

        case Event?.PlaybackQueueEnded:
          console.log("[TrackPlayer] Queue ended");
          break;

        case Event?.PlaybackMetadataReceived:
          console.log(
            "[TrackPlayer] Metadata received:",
            event.metadata
          );
          break;
      }
    });
  }
};
