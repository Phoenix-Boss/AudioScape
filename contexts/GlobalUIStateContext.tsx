// contexts/GlobalUIStateContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import TrackPlayer, { usePlaybackState, State, Event, useTrackPlayerEvents } from 'react-native-track-player';
import { triggerHaptic } from '@/helpers/haptics';

interface GlobalUIStateContextType {
  tabsVisible: boolean;
  tabsLocked: boolean;
  handleVisible: boolean;
  isMusicPlaying: boolean;
  // Methods
  setTabsVisible: (visible: boolean, isUserAction?: boolean) => void;
  resetNavigationState: () => void;
  setIsMusicPlaying: (playing: boolean) => void;
  setHandleVisible: (visible: boolean) => void;
  setTabsLocked: (locked: boolean) => void;
  handleUserTappedHandle: () => void;
}

const GlobalUIStateContext = createContext<GlobalUIStateContextType | undefined>(undefined);

export const GlobalUIStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabsVisible, setTabsVisibleState] = useState(true);
  const [tabsLocked, setTabsLockedState] = useState(false);
  const [handleVisible, setHandleVisibleState] = useState(false);
  const [isMusicPlaying, setIsMusicPlayingState] = useState(false);
  
  // Use the hook instead of calling TrackPlayer.getState()
  const playbackState = usePlaybackState();
  const currentPlaybackState = playbackState.state;

  // Listen to track player events to sync UI state
  useTrackPlayerEvents([Event.PlaybackState, Event.PlaybackError], async (event) => {
    if (event.type === Event.PlaybackState) {
      const isNowPlaying = event.state === State.Playing || 
                          event.state === State.Buffering || 
                          event.state === State.Ready;
      
      setIsMusicPlayingState(isNowPlaying);
      setHandleVisibleState(isNowPlaying);
      
      if (isNowPlaying) {
        // When music starts playing, hide tabs by default (unless user already showed them)
        if (!tabsLocked) {
          setTabsVisibleState(false);
        }
      } else {
        // When music stops, show tabs if not locked
        if (!tabsLocked) {
          setTabsVisibleState(true);
        }
        // Reset lock when music stops
        setTabsLockedState(false);
      }
    }
    
    if (event.type === Event.PlaybackError) {
      console.warn('Playback error:', event);
      setIsMusicPlayingState(false);
      setHandleVisibleState(false);
      // Reset lock on error
      setTabsLockedState(false);
    }
  });

  // Initial check for playback state - SIMPLIFIED VERSION
  useEffect(() => {
    const checkInitialPlaybackState = () => {
      try {
        const isNowPlaying = currentPlaybackState === State.Playing || 
                            currentPlaybackState === State.Buffering || 
                            currentPlaybackState === State.Ready;
        
        setIsMusicPlayingState(isNowPlaying);
        setHandleVisibleState(isNowPlaying);
        
        // Set initial tabs visibility based on music state
        if (isNowPlaying) {
          setTabsVisibleState(false); // Hide tabs if music is playing
        } else {
          setTabsVisibleState(true); // Show tabs if no music
        }
        
        console.log('Initial playback state checked:', State[currentPlaybackState]);
      } catch (error) {
        console.warn('Error checking initial playback state:', error);
        // Default to no music playing on error
        setIsMusicPlayingState(false);
        setHandleVisibleState(false);
        setTabsVisibleState(true);
      }
    };
    
    checkInitialPlaybackState();
  }, [currentPlaybackState]);

  // Update handle visibility based on playback state
  useEffect(() => {
    const isNowPlaying = currentPlaybackState === State.Playing || 
                        currentPlaybackState === State.Buffering || 
                        currentPlaybackState === State.Ready;
    
    setIsMusicPlayingState(isNowPlaying);
    setHandleVisibleState(isNowPlaying);
    
    // Auto-manage tabs based on music state
    if (isNowPlaying && !tabsLocked) {
      setTabsVisibleState(false); // Hide tabs when music starts
    } else if (!isNowPlaying && !tabsLocked) {
      setTabsVisibleState(true); // Show tabs when music stops
    }
  }, [currentPlaybackState, tabsLocked]);

  const setTabsVisible = useCallback((visible: boolean, isUserAction: boolean = false) => {
    setTabsVisibleState(visible);
    if (isUserAction) {
      // When user manually controls tabs, set lock accordingly
      setTabsLockedState(visible); // Lock if showing, unlock if hiding
    }
  }, []);

  const setTabsLocked = useCallback((locked: boolean) => {
    setTabsLockedState(locked);
  }, []);

  // Handle user tapping the handle (called from FloatingPlayer)
  const handleUserTappedHandle = useCallback(() => {
    if (!isMusicPlaying) return;
    
    const newVisibility = !tabsVisible;
    
    if (newVisibility) {
      // User is SHOWING tabs - set user intent and lock
      setTabsLockedState(true);
      setTabsVisibleState(true);
      triggerHaptic(); // Add haptic feedback
    } else {
      // User is HIDING tabs - clear user intent and unlock
      setTabsLockedState(false);
      setTabsVisibleState(false);
      triggerHaptic(); // Add haptic feedback
    }
  }, [isMusicPlaying, tabsVisible]);

  const resetNavigationState = useCallback(() => {
    setTabsVisibleState(false);
    setTabsLockedState(false);
  }, []);

  const setIsMusicPlaying = useCallback((playing: boolean) => {
    setIsMusicPlayingState(playing);
  }, []);

  const setHandleVisible = useCallback((visible: boolean) => {
    setHandleVisibleState(visible);
  }, []);

  return (
    <GlobalUIStateContext.Provider value={{
      tabsVisible,
      tabsLocked,
      handleVisible,
      isMusicPlaying,
      // Methods
      setTabsVisible,
      resetNavigationState,
      setIsMusicPlaying,
      setHandleVisible,
      setTabsLocked,
      handleUserTappedHandle,
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