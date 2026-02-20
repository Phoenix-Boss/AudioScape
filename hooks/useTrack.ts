// src/hooks/useTrack.ts
import { useState, useCallback } from 'react';
import getTrack from '../services/api/track/get';
import { TrackData, Source, GetTrackParams } from '../services/types/track';

interface UseTrackReturn {
  fetchTrack: (params: GetTrackParams) => Promise<void>;
  track: TrackData | null;
  loading: boolean;
  error: string | null;
  clearTrack: () => void;
}

export const useTrack = (): UseTrackReturn => {
  const [track, setTrack] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrack = useCallback(async (params: GetTrackParams) => {
    if (!params.artistName && !params.trackId) {
      setError('Either artistName or trackId is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getTrack(params);

      if (result) {
        setTrack(result);
      } else {
        setError('Track not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch track');
      console.error('Track fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearTrack = useCallback(() => {
    setTrack(null);
    setError(null);
  }, []);

  return {
    fetchTrack,
    track,
    loading,
    error,
    clearTrack,
  };
};