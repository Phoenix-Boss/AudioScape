// src/stores/player.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackData } from '../services/types/track';

interface PlayerState {
  currentTrack: TrackData | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoop: boolean;
  isAutoplay: boolean;
  queue: TrackData[];
  history: TrackData[];
  setPlaying: (track: TrackData) => void;
  setPaused: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setMuted: (isMuted: boolean) => void;
  setLoop: (isLoop: boolean) => void;
  setAutoplay: (isAutoplay: boolean) => void;
  addToQueue: (track: TrackData) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  next: () => void;
  previous: () => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      isMuted: false,
      isLoop: false,
      isAutoplay: true,
      queue: [],
      history: [],

      setPlaying: (track) => {
        set({
          currentTrack: track,
          isPlaying: true,
          duration: track.duration || 0,
        });
        // Add to history
        set((state) => ({
          history: [track, ...state.history].slice(0, 50),
        }));
      },

      setPaused: () => set({ isPlaying: false }),

      setCurrentTime: (time) => set({ currentTime: time }),

      setDuration: (duration) => set({ duration }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

      setMuted: (isMuted) => set({ isMuted }),

      setLoop: (isLoop) => set({ isLoop }),

      setAutoplay: (isAutoplay) => set({ isAutoplay }),

      addToQueue: (track) =>
        set((state) => ({
          queue: [...state.queue, track],
        })),

      removeFromQueue: (index) =>
        set((state) => ({
          queue: state.queue.filter((_, i) => i !== index),
        })),

      clearQueue: () => set({ queue: [] }),

      next: () => {
        const { queue } = get();
        if (queue.length > 0) {
          const nextTrack = queue[0];
          set({
            queue: queue.slice(1),
          });
          get().setPlaying(nextTrack);
        }
      },

      previous: () => {
        const { history } = get();
        if (history.length > 1) {
          const prevTrack = history[1];
          set({
            history: history.slice(1),
          });
          get().setPlaying(prevTrack);
        }
      },
    }),
    {
      name: 'player-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        volume: state.volume,
        isLoop: state.isLoop,
        isAutoplay: state.isAutoplay,
        queue: state.queue,
        history: state.history.slice(0, 20),
      }),
    }
  )
);