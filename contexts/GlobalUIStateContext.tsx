import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import TrackPlayer, { usePlaybackState, State } from 'react-native-track-player';
import { triggerHaptic } from '@/helpers/haptics';

interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: string;
  plays?: string;
}

interface GlobalUIStateContextType {
  tabsVisible: boolean;
  tabsLocked: boolean;
  handleVisible: boolean;
  isMusicPlaying: boolean;
  // Dummy playback state
  currentTrack: Track | null;
  dummyIsPlaying: boolean;
  playbackProgress: number;
  // Methods
  setTabsVisible: (visible: boolean, isUserAction?: boolean) => void;
  resetNavigationState: () => void;
  // Dummy playback methods
  playTrack: (track: Track) => void;
  toggleDummyPlayPause: () => void;
  playNextTrack: () => void;
  playPreviousTrack: () => void;
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
}

const GlobalUIStateContext = createContext<GlobalUIStateContextType | undefined>(undefined);

export const GlobalUIStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabsVisible, setTabsVisibleState] = useState(false);
  const [tabsLocked, setTabsLocked] = useState(false);
  const [handleVisible, setHandleVisible] = useState(false);
  
  // Dummy playback state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [dummyIsPlaying, setDummyIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  
  const playbackState = usePlaybackState();
  const isMusicPlaying = playbackState.state === State.Playing || 
                        playbackState.state === State.Buffering || 
                        playbackState.state === State.Ready;

  // Simulate progress when dummy playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (dummyIsPlaying && currentTrack) {
      interval = setInterval(() => {
        setPlaybackProgress(prev => {
          if (prev >= 100) {
            // Song ended, play next if available
            if (queue.length > currentTrackIndex + 1) {
              const nextTrack = queue[currentTrackIndex + 1];
              triggerHaptic('light');
              setCurrentTrack(nextTrack);
              setCurrentTrackIndex(prevIdx => prevIdx + 1);
              return 0;
            } else {
              setDummyIsPlaying(false);
              return 0;
            }
          }
          return prev + 0.5; // 0.5% per second
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [dummyIsPlaying, currentTrack, queue, currentTrackIndex]);

  useEffect(() => {
    setHandleVisible(isMusicPlaying || dummyIsPlaying);
    if (!isMusicPlaying && !dummyIsPlaying) {
      setTabsVisibleState(false);
      setTabsLocked(false);
    }
  }, [isMusicPlaying, dummyIsPlaying]);

  const setTabsVisible = useCallback((visible: boolean, isUserAction: boolean = false) => {
    setTabsVisibleState(visible);
    if (isUserAction && visible) setTabsLocked(true);
    if (isUserAction && !visible) setTabsLocked(false);
  }, []);

  const resetNavigationState = useCallback(() => {
    setTabsVisibleState(false);
    setTabsLocked(false);
  }, []);

  // Dummy playback methods
  const playTrack = useCallback((track: Track) => {
    triggerHaptic('medium');
    
    setQueue(prevQueue => {
      const trackIndex = prevQueue.findIndex(t => t.id === track.id);
      if (trackIndex !== -1) {
        // Track is in queue, play it
        setCurrentTrack(track);
        setCurrentTrackIndex(trackIndex);
        setDummyIsPlaying(true);
        setPlaybackProgress(0);
        return prevQueue;
      } else {
        // New track, add to queue and play
        const newQueue = [...prevQueue, track];
        setCurrentTrack(track);
        setCurrentTrackIndex(newQueue.length - 1);
        setDummyIsPlaying(true);
        setPlaybackProgress(0);
        return newQueue;
      }
    });
  }, []);

  const toggleDummyPlayPause = useCallback(() => {
    triggerHaptic('light');
    setDummyIsPlaying(prev => !prev);
  }, []);

  const playNextTrack = useCallback(() => {
    triggerHaptic('light');
    if (queue.length > currentTrackIndex + 1) {
      const nextTrack = queue[currentTrackIndex + 1];
      setCurrentTrack(nextTrack);
      setCurrentTrackIndex(prev => prev + 1);
      setPlaybackProgress(0);
    }
  }, [queue, currentTrackIndex]);

  const playPreviousTrack = useCallback(() => {
    triggerHaptic('light');
    if (currentTrackIndex > 0) {
      const prevTrack = queue[currentTrackIndex - 1];
      setCurrentTrack(prevTrack);
      setCurrentTrackIndex(prev => prev - 1);
      setPlaybackProgress(0);
    } else if (currentTrack) {
      // Restart current track
      setPlaybackProgress(0);
    }
  }, [queue, currentTrackIndex, currentTrack]);

  const addToQueue = useCallback((track: Track) => {
    setQueue(prev => [...prev, track]);
    triggerHaptic('light');
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentTrack(null);
    setCurrentTrackIndex(-1);
    setDummyIsPlaying(false);
    setPlaybackProgress(0);
  }, []);

  return (
    <GlobalUIStateContext.Provider value={{
      tabsVisible,
      tabsLocked,
      handleVisible,
      isMusicPlaying,
      // Dummy playback state
      currentTrack,
      dummyIsPlaying,
      playbackProgress,
      // Methods
      setTabsVisible,
      resetNavigationState,
      // Dummy playback methods
      playTrack,
      toggleDummyPlayPause,
      playNextTrack,
      playPreviousTrack,
      addToQueue,
      clearQueue,
    }}>
      {children}
    </GlobalUIStateContext.Provider>
  );
};

export const useGlobalUIState = () => {
  const context = useContext(GlobalUIStateContext);
  if (!context) throw new Error('useGlobalUIState must be used within GlobalUIStateProvider');
  return context;
};