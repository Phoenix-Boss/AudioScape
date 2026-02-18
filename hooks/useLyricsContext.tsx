/**
 * Lyrics Context
 * Fetches synced lyrics for the currently active track
 * and provides them throughout the app.
 */

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useActiveTrack } from "react-native-track-player";
import { Client, Query } from "lrclib-api";

const client = new Client();

/**
 * Represents a single line of a song's lyrics.
 */
export type LyricLine = {
  text: string;
  startTime?: number;
};

export type LyricsContextType = {
  lyrics: LyricLine[];
  isFetchingLyrics: boolean;
  heights: number[];
  updateHeight: (index: number, height: number) => void;
  resetHeights: (length: number) => void;
};

const LyricsContext = createContext<LyricsContextType | undefined>(undefined);

export const LyricsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isFetchingLyrics, setIsFetchingLyrics] = useState(false);
  const [heights, setHeights] = useState<number[]>([]);
  const [lastLoadedTrackId, setLastLoadedTrackId] = useState<string | null>(
    null
  );

  const activeTrack = useActiveTrack();
  const activeTrackIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    activeTrackIdRef.current = activeTrack?.id;
  }, [activeTrack?.id]);

  /**
   * Fetch lyrics for active track
   */
  const fetchLyrics = useCallback(async () => {
    if (!activeTrack) return;

    if (lastLoadedTrackId === activeTrack.id) return;

    setLastLoadedTrackId(activeTrack.id);
    setIsFetchingLyrics(true);

    try {
      if (activeTrack.title && activeTrack.artist) {
        const searchParams: Query = {
          track_name: activeTrack.title,
          artist_name: activeTrack.artist,
        };

        if (activeTrack.duration) {
          searchParams.duration = activeTrack.duration * 1000;
        }

        const syncedLyrics = await client.getSynced(searchParams);

        // Prevent race condition if track changed mid-fetch
        if (activeTrackIdRef.current !== activeTrack.id) return;

        if (syncedLyrics && syncedLyrics.length > 0) {
          const sortedLyrics = [...syncedLyrics].sort(
            (a, b) => (a.startTime || 0) - (b.startTime || 0)
          );

          setLyrics(sortedLyrics);
          setHeights(new Array(sortedLyrics.length).fill(0));
        } else {
          setLyrics([{ text: "No lyrics available", startTime: 0 }]);
          setHeights([0]);
        }
      } else {
        setLyrics([{ text: "No lyrics available", startTime: 0 }]);
        setHeights([0]);
      }
    } catch (error) {
      console.error("Error fetching lyrics:", error);

      if (activeTrackIdRef.current === activeTrack.id) {
        setLyrics([{ text: "Error loading lyrics", startTime: 0 }]);
        setHeights([0]);
      }
    } finally {
      if (activeTrackIdRef.current === activeTrack.id) {
        setIsFetchingLyrics(false);
      }
    }
  }, [activeTrack, lastLoadedTrackId]);

  /**
   * Trigger fetch when track changes
   */
  useEffect(() => {
    if (activeTrack?.id && activeTrack.id !== lastLoadedTrackId) {
      fetchLyrics();
    }

    if (!activeTrack) {
      setLyrics([]);
      setHeights([]);
      setLastLoadedTrackId(null);
    }
  }, [activeTrack?.id, fetchLyrics, lastLoadedTrackId]);

  /**
   * Update specific lyric height
   */
  const updateHeight = useCallback((index: number, height: number) => {
    setHeights((prev) => {
      const updated = [...prev];
      updated[index] = height;
      return updated;
    });
  }, []);

  /**
   * Reset heights
   */
  const resetHeights = useCallback((length: number) => {
    setHeights(new Array(length).fill(0));
  }, []);

  return (
    <LyricsContext.Provider
      value={{
        lyrics,
        isFetchingLyrics,
        heights,
        updateHeight,
        resetHeights,
      }}
    >
      {children}
    </LyricsContext.Provider>
  );
};

export const useLyricsContext = () => {
  const context = useContext(LyricsContext);
  if (!context) {
    throw new Error("useLyricsContext must be used within LyricsProvider");
  }
  return context;
};
