// contexts/GlobalUIStateContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  usePlaybackState,
  State as TPState, // Works for v3
  PlaybackState as TPPlaybackState, // Works for v4
} from "react-native-track-player";
import { triggerHaptic } from "@/helpers/haptics";

interface GlobalUIStateContextType {
  tabsVisible: boolean;
  tabsLocked: boolean;
  handleVisible: boolean;
  isMusicPlaying: boolean;
  setTabsVisible: (visible: boolean, isUserAction?: boolean) => void;
  resetNavigationState: () => void;
  setIsMusicPlaying: (playing: boolean) => void;
  setHandleVisible: (visible: boolean) => void;
  setTabsLocked: (locked: boolean) => void;
  handleUserTappedHandle: () => void;
}

const GlobalUIStateContext =
  createContext<GlobalUIStateContextType | undefined>(undefined);

export const GlobalUIStateProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [tabsVisible, setTabsVisibleState] = useState(true);
  const [tabsLocked, setTabsLockedState] = useState(false);
  const [handleVisible, setHandleVisibleState] = useState(false);
  const [isMusicPlaying, setIsMusicPlayingState] = useState(false);

  const playbackState = usePlaybackState();

  /**
   * Normalize playback state for v3 and v4 compatibility
   */
  const currentState = useMemo(() => {
    // v4 returns object with `.state`
    if (typeof playbackState === "object" && "state" in playbackState) {
      return playbackState.state;
    }

    // v3 returns enum directly
    return playbackState;
  }, [playbackState]);

  /**
   * Determine if music is playing
   */
  const isPlaying = useMemo(() => {
    // Support both v3 and v4 enums
    const Playing =
      TPPlaybackState?.Playing ?? TPState?.Playing;

    const Buffering =
      TPPlaybackState?.Buffering ?? TPState?.Buffering;

    return currentState === Playing || currentState === Buffering;
  }, [currentState]);

  /**
   * Sync UI when playback changes
   */
  useEffect(() => {
    setIsMusicPlayingState(isPlaying);
    setHandleVisibleState(isPlaying);

    if (!tabsLocked) {
      setTabsVisibleState(!isPlaying);
    }

    if (!isPlaying) {
      setTabsLockedState(false);
    }
  }, [isPlaying, tabsLocked]);

  /**
   * User manually toggles tabs
   */
  const setTabsVisible = useCallback(
    (visible: boolean, isUserAction: boolean = false) => {
      setTabsVisibleState(visible);

      if (isUserAction) {
        setTabsLockedState(visible);
      }
    },
    []
  );

  const setTabsLocked = useCallback((locked: boolean) => {
    setTabsLockedState(locked);
  }, []);

  const handleUserTappedHandle = useCallback(() => {
    if (!isMusicPlaying) return;

    const newVisibility = !tabsVisible;

    if (newVisibility) {
      setTabsLockedState(true);
      setTabsVisibleState(true);
    } else {
      setTabsLockedState(false);
      setTabsVisibleState(false);
    }

    triggerHaptic();
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
    <GlobalUIStateContext.Provider
      value={{
        tabsVisible,
        tabsLocked,
        handleVisible,
        isMusicPlaying,
        setTabsVisible,
        resetNavigationState,
        setIsMusicPlaying,
        setHandleVisible,
        setTabsLocked,
        handleUserTappedHandle,
      }}
    >
      {children}
    </GlobalUIStateContext.Provider>
  );
};

export const useGlobalUIState = () => {
  const context = useContext(GlobalUIStateContext);
  if (!context) {
    throw new Error(
      "useGlobalUIState must be used within GlobalUIStateProvider"
    );
  }
  return context;
};
