// src/hooks/usePlayerSearch.ts
import { useState, useCallback } from 'react';
import getPlayerSearch, { PlayerSearchResult } from '../services/api/player/search/get';
import { TrackData, Source } from '../services/types/track';

interface UsePlayerSearchReturn {
  search: (trackData: TrackData, source?: Source) => Promise<void>;
  results: PlayerSearchResult | null;
  loading: boolean;
  error: string | null;
  clearResults: () => void;
}

export const usePlayerSearch = (): UsePlayerSearchReturn => {
  const [results, setResults] = useState<PlayerSearchResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (trackData: TrackData, source?: Source) => {
    if (!trackData.artist || !trackData.title) {
      setError('Track must have artist and title');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getPlayerSearch({
        trackData: {
          artist: trackData.artist,
          title: trackData.title,
          id: trackData.id,
        },
        source,
      });

      if (result) {
        setResults(result);
      } else {
        setError('No results found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      console.error('Player search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
  }, []);

  return {
    search,
    results,
    loading,
    error,
    clearResults,
  };
};