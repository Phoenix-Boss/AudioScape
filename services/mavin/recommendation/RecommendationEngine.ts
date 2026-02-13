/**
 * MAVIN RECOMMENDATION ENGINE — CLIENT-ONLY
 * Pure client-side recommendation system
 */

import { useState, useEffect, useCallback } from 'react';
import * as Crypto from 'expo-crypto';
import { SecureStorage } from '../../storage/SecureStore';

// ============================================================================
// TYPES
// ============================================================================

export type RecommendationType = 
  | 'personalized' 
  | 'similar_artist' 
  | 'genre_match' 
  | 'trending'
  | 'recently_played'
  | 'featured';

export interface Recommendation {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  artwork?: string | null;
  duration?: number;
  videoId?: string;
  reason: RecommendationType;
  confidence: number;
  score?: number;
  tags?: string[];
}

export interface RecommendationOptions {
  trackId?: string;
  type?: RecommendationType;
  limit?: number;
  offset?: number;
}

export interface RadioStation {
  id: string;
  name: string;
  seed: string;
  tracks: Recommendation[];
  createdAt: number;
}

// ============================================================================
// MOCK DATABASE — CLIENT-SIDE RECOMMENDATIONS
// ============================================================================

const MOCK_SONGS = [
  {
    id: 'song-1',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    artistId: 'artist-queen',
    album: 'A Night at the Opera',
    albumId: 'album-queen-1',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
    duration: 354,
    videoId: 'fJ9rUzIMcZQ',
    genre: 'rock',
    tags: ['classic', '70s', 'progressive'],
  },
  {
    id: 'song-2',
    title: 'Imagine',
    artist: 'John Lennon',
    artistId: 'artist-lennon',
    album: 'Imagine',
    albumId: 'album-lennon-1',
    artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
    duration: 183,
    videoId: 'YkgkThdzX-8',
    genre: 'rock',
    tags: ['classic', '70s', 'singer-songwriter'],
  },
  {
    id: 'song-3',
    title: 'Hotel California',
    artist: 'Eagles',
    artistId: 'artist-eagles',
    album: 'Hotel California',
    albumId: 'album-eagles-1',
    artwork: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76',
    duration: 390,
    videoId: 'BciS5krYL80',
    genre: 'rock',
    tags: ['classic', '70s', 'soft-rock'],
  },
  {
    id: 'song-4',
    title: 'Shape of You',
    artist: 'Ed Sheeran',
    artistId: 'artist-sheeran',
    album: '÷',
    albumId: 'album-sheeran-1',
    artwork: 'https://images.unsplash.com/photo-1499415479124-43c32433a620',
    duration: 233,
    videoId: 'JGwWNGJdvx8',
    genre: 'pop',
    tags: ['2010s', 'dance', 'acoustic'],
  },
  {
    id: 'song-5',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    artistId: 'artist-weeknd',
    album: 'After Hours',
    albumId: 'album-weeknd-1',
    artwork: 'https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d',
    duration: 200,
    videoId: '4NRXx6U8ABQ',
    genre: 'pop',
    tags: ['2020s', 'synthwave', 'dance'],
  },
  {
    id: 'song-6',
    title: 'Dance Monkey',
    artist: 'Tones and I',
    artistId: 'artist-tones',
    album: 'The Kids Are Coming',
    albumId: 'album-tones-1',
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745',
    duration: 209,
    videoId: 'q0hyYWKXF0Q',
    genre: 'pop',
    tags: ['2010s', 'dance', 'electronic'],
  },
  {
    id: 'song-7',
    title: 'Sicko Mode',
    artist: 'Travis Scott',
    artistId: 'artist-scott',
    album: 'Astroworld',
    albumId: 'album-scott-1',
    artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
    duration: 312,
    videoId: '6ONRf7h3Mdk',
    genre: 'hip-hop',
    tags: ['2010s', 'trap', 'rap'],
  },
  {
    id: 'song-8',
    title: 'God\'s Plan',
    artist: 'Drake',
    artistId: 'artist-drake',
    album: 'Scary Hours',
    albumId: 'album-drake-1',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
    duration: 198,
    videoId: 'xpVfcZ0ZcFM',
    genre: 'hip-hop',
    tags: ['2010s', 'rap', 'dancehall'],
  },
  {
    id: 'song-9',
    title: 'Take Five',
    artist: 'Dave Brubeck',
    artistId: 'artist-brubeck',
    album: 'Time Out',
    albumId: 'album-brubeck-1',
    artwork: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629',
    duration: 324,
    videoId: 'vmDDOFXSgAs',
    genre: 'jazz',
    tags: ['1950s', 'cool-jazz', 'instrumental'],
  },
  {
    id: 'song-10',
    title: 'So What',
    artist: 'Miles Davis',
    artistId: 'artist-davis',
    album: 'Kind of Blue',
    albumId: 'album-davis-1',
    artwork: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f',
    duration: 562,
    videoId: 'zqNTltOGh5c',
    genre: 'jazz',
    tags: ['1950s', 'modal-jazz', 'instrumental'],
  },
  {
    id: 'song-11',
    title: 'Stairway to Heaven',
    artist: 'Led Zeppelin',
    artistId: 'artist-zeppelin',
    album: 'Led Zeppelin IV',
    albumId: 'album-zeppelin-1',
    artwork: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee',
    duration: 482,
    videoId: 'QkF3oxziUI4',
    genre: 'rock',
    tags: ['70s', 'classic-rock', 'epic'],
  },
  {
    id: 'song-12',
    title: 'Smells Like Teen Spirit',
    artist: 'Nirvana',
    artistId: 'artist-nirvana',
    album: 'Nevermind',
    albumId: 'album-nirvana-1',
    artwork: 'https://images.unsplash.com/photo-1499415479124-43c32433a620',
    duration: 301,
    videoId: 'hTWKbfoikeg',
    genre: 'rock',
    tags: ['90s', 'grunge', 'alternative'],
  },
  {
    id: 'song-13',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    artistId: 'artist-jackson',
    album: 'Thriller',
    albumId: 'album-jackson-1',
    artwork: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76',
    duration: 294,
    videoId: 'Zi_XLOBDo_Y',
    genre: 'pop',
    tags: ['80s', 'dance', 'r&b'],
  },
  {
    id: 'song-14',
    title: 'Lose Yourself',
    artist: 'Eminem',
    artistId: 'artist-eminem',
    album: '8 Mile',
    albumId: 'album-eminem-1',
    artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
    duration: 326,
    videoId: '_Yhyp-_hX2s',
    genre: 'hip-hop',
    tags: ['2000s', 'rap', 'inspirational'],
  },
  {
    id: 'song-15',
    title: 'Africa',
    artist: 'Toto',
    artistId: 'artist-toto',
    album: 'Toto IV',
    albumId: 'album-toto-1',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
    duration: 295,
    videoId: 'FTQbiNvZqaY',
    genre: 'rock',
    tags: ['80s', 'soft-rock', 'classic'],
  },
];

const GENRE_MAP: Record<string, string[]> = {
  'rock': ['pop', 'alternative', 'classic-rock'],
  'pop': ['dance', 'r&b', 'electronic'],
  'hip-hop': ['rap', 'trap', 'r&b'],
  'jazz': ['blues', 'soul', 'classical'],
  'electronic': ['dance', 'pop', 'house'],
};

const STORAGE_KEYS = {
  RECENTLY_PLAYED: 'recently_played',
  RADIO_STATIONS: 'radio_stations',
  USER_PREFERENCES: 'user_prefs',
};

// ============================================================================
// RECOMMENDATION ALGORITHMS
// ============================================================================

class RecommendationAlgorithm {
  static getRecommendations(
    trackId?: string,
    type: RecommendationType = 'personalized',
    limit: number = 20,
    offset: number = 0
  ): Recommendation[] {
    let recommendations: Recommendation[] = [];

    switch (type) {
      case 'personalized':
        recommendations = this.getPersonalized(trackId);
        break;
      case 'similar_artist':
        recommendations = this.getSimilarArtist(trackId);
        break;
      case 'genre_match':
        recommendations = this.getGenreMatch(trackId);
        break;
      case 'trending':
        recommendations = this.getTrending();
        break;
      case 'recently_played':
        recommendations = this.getRecentlyPlayed();
        break;
      case 'featured':
        recommendations = this.getFeatured();
        break;
      default:
        recommendations = this.getPersonalized(trackId);
    }

    return recommendations.slice(offset, offset + limit);
  }

  private static getPersonalized(seedId?: string): Recommendation[] {
    const seed = MOCK_SONGS.find(s => s.id === seedId);
    
    if (!seed) {
      return this.shuffleArray(MOCK_SONGS)
        .slice(0, 15)
        .map(song => this.songToRecommendation(song, 'personalized', 0.7 + Math.random() * 0.2));
    }

    const candidates = MOCK_SONGS.filter(song => 
      song.id !== seed.id && (
        song.genre === seed.genre ||
        song.tags.some(tag => seed.tags.includes(tag))
      )
    );

    return candidates
      .map(song => {
        let confidence = 0.5;
        
        if (song.genre === seed.genre) confidence += 0.2;
        
        const commonTags = song.tags.filter(tag => seed.tags.includes(tag)).length;
        confidence += commonTags * 0.1;
        
        if (song.artist === seed.artist) confidence += 0.3;
        
        return this.songToRecommendation(song, 'personalized', Math.min(0.99, confidence));
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);
  }

  private static getSimilarArtist(seedId?: string): Recommendation[] {
    const seed = MOCK_SONGS.find(s => s.id === seedId);
    
    if (!seed) {
      return this.getPersonalized(seedId);
    }

    const candidates = MOCK_SONGS.filter(song => 
      song.id !== seed.id && 
      song.artist !== seed.artist &&
      song.genre === seed.genre
    );

    return candidates
      .map(song => this.songToRecommendation(song, 'similar_artist', 0.8 + Math.random() * 0.15))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);
  }

  private static getGenreMatch(seedId?: string): Recommendation[] {
    const seed = MOCK_SONGS.find(s => s.id === seedId);
    
    if (!seed) {
      return this.getPersonalized(seedId);
    }

    const relatedGenres = GENRE_MAP[seed.genre] || [seed.genre];
    
    const candidates = MOCK_SONGS.filter(song => 
      song.id !== seed.id &&
      relatedGenres.includes(song.genre)
    );

    return candidates
      .map(song => this.songToRecommendation(song, 'genre_match', 0.75 + Math.random() * 0.2))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20);
  }

  private static getTrending(): Recommendation[] {
    return this.shuffleArray(MOCK_SONGS)
      .slice(0, 15)
      .map(song => this.songToRecommendation(song, 'trending', 0.85 + Math.random() * 0.1));
  }

  private static getRecentlyPlayed(): Recommendation[] {
    return this.shuffleArray(MOCK_SONGS)
      .slice(0, 10)
      .map(song => this.songToRecommendation(song, 'recently_played', 0.6 + Math.random() * 0.3));
  }

  private static getFeatured(): Recommendation[] {
    return MOCK_SONGS
      .filter(song => ['song-1', 'song-5', 'song-8', 'song-11', 'song-13'].includes(song.id))
      .map(song => this.songToRecommendation(song, 'featured', 0.9 + Math.random() * 0.09));
  }

  private static songToRecommendation(
    song: typeof MOCK_SONGS[0],
    reason: RecommendationType,
    confidence: number
  ): Recommendation {
    return {
      id: Crypto.randomUUID(), // ✅ Native UUID
      title: song.title,
      artist: song.artist,
      artistId: song.artistId,
      album: song.album,
      albumId: song.albumId,
      artwork: song.artwork,
      duration: song.duration,
      videoId: song.videoId,
      reason,
      confidence,
      score: Math.round(confidence * 100),
      tags: song.tags,
    };
  }

  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

// ============================================================================
// RADIO STATION MANAGER
// ============================================================================

class RadioStationManager {
  private static instance: RadioStationManager;
  private stations: Map<string, RadioStation> = new Map();

  private constructor() {}

  static getInstance(): RadioStationManager {
    if (!RadioStationManager.instance) {
      RadioStationManager.instance = new RadioStationManager();
    }
    return RadioStationManager.instance;
  }

  async createStation(seed: string, name: string): Promise<RadioStation> {
    const tracks = RecommendationAlgorithm.getRecommendations(seed, 'personalized', 50, 0);
    
    const station: RadioStation = {
      id: Crypto.randomUUID(), // ✅ Native UUID
      name,
      seed,
      tracks,
      createdAt: Date.now(),
    };

    this.stations.set(station.id, station);

    try {
      const stations = await this.getStations();
      stations.push(station);
      await SecureStorage.setItem(STORAGE_KEYS.RADIO_STATIONS, stations);
    } catch {
      // Silent fail
    }

    return station;
  }

  async getStation(id: string): Promise<RadioStation | null> {
    if (this.stations.has(id)) {
      return this.stations.get(id) || null;
    }

    try {
      const stations = await this.getStations();
      const station = stations.find(s => s.id === id);
      if (station) {
        this.stations.set(id, station);
      }
      return station || null;
    } catch {
      return null;
    }
  }

  async getStations(): Promise<RadioStation[]> {
    try {
      const stored = await SecureStorage.getItem<RadioStation[]>(STORAGE_KEYS.RADIO_STATIONS);
      return stored || [];
    } catch {
      return [];
    }
  }

  async deleteStation(id: string): Promise<boolean> {
    this.stations.delete(id);
    
    try {
      const stations = await this.getStations();
      const filtered = stations.filter(s => s.id !== id);
      await SecureStorage.setItem(STORAGE_KEYS.RADIO_STATIONS, filtered);
      return true;
    } catch {
      return false;
    }
  }

  async getNextTrack(stationId: string): Promise<Recommendation | null> {
    const station = await this.getStation(stationId);
    if (!station) return null;

    const nextIndex = Math.floor(Math.random() * station.tracks.length);
    return station.tracks[nextIndex];
  }
}

// ============================================================================
// RECENTLY PLAYED MANAGER
// ============================================================================

class RecentlyPlayedManager {
  private static instance: RecentlyPlayedManager;
  private recentlyPlayed: Recommendation[] = [];
  private readonly MAX_ITEMS = 50;

  private constructor() {}

  static getInstance(): RecentlyPlayedManager {
    if (!RecentlyPlayedManager.instance) {
      RecentlyPlayedManager.instance = new RecentlyPlayedManager();
    }
    return RecentlyPlayedManager.instance;
  }

  async addTrack(track: Partial<Recommendation>): Promise<void> {
    const recommendation: Recommendation = {
      id: Crypto.randomUUID(), // ✅ Native UUID
      title: track.title || 'Unknown Track',
      artist: track.artist || 'Unknown Artist',
      artistId: track.artistId,
      album: track.album,
      albumId: track.albumId,
      artwork: track.artwork,
      duration: track.duration,
      videoId: track.videoId,
      reason: 'recently_played',
      confidence: 1.0,
    };

    this.recentlyPlayed.unshift(recommendation);
    
    if (this.recentlyPlayed.length > this.MAX_ITEMS) {
      this.recentlyPlayed = this.recentlyPlayed.slice(0, this.MAX_ITEMS);
    }

    try {
      await SecureStorage.setItem(STORAGE_KEYS.RECENTLY_PLAYED, this.recentlyPlayed);
    } catch {
      // Silent fail
    }
  }

  async getRecentlyPlayed(limit: number = 20): Promise<Recommendation[]> {
    if (this.recentlyPlayed.length === 0) {
      try {
        const stored = await SecureStorage.getItem<Recommendation[]>(STORAGE_KEYS.RECENTLY_PLAYED);
        if (stored) {
          this.recentlyPlayed = stored;
        }
      } catch {
        // Use empty array
      }
    }

    return this.recentlyPlayed.slice(0, limit);
  }

  async clear(): Promise<void> {
    this.recentlyPlayed = [];
    await SecureStorage.removeItem(STORAGE_KEYS.RECENTLY_PLAYED);
  }
}

// ============================================================================
// HOOK: useRecommendations
// ============================================================================

export const useRecommendations = (options: RecommendationOptions = {}) => {
  const [data, setData] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(0);

  const {
    trackId,
    type = 'personalized',
    limit = 20,
    offset = 0,
  } = options;

  const fetchRecommendations = useCallback(async (pageNum: number = 0) => {
    const results = RecommendationAlgorithm.getRecommendations(
      trackId,
      type,
      limit,
      pageNum * limit
    );

    return {
      items: results,
      nextOffset: (pageNum + 1) * limit,
      hasMore: results.length === limit,
    };
  }, [trackId, type, limit]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchRecommendations(0);
        if (isMounted) {
          setData(result.items);
          setPage(0);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load recommendations'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [fetchRecommendations]);

  const fetchNextPage = useCallback(async () => {
    if (isFetchingNextPage) return;

    setIsFetchingNextPage(true);
    setError(null);

    try {
      const result = await fetchRecommendations(page + 1);
      setData(prev => [...prev, ...result.items]);
      setPage(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more recommendations'));
    } finally {
      setIsFetchingNextPage(false);
    }
  }, [fetchRecommendations, page, isFetchingNextPage]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchRecommendations(0);
      setData(result.items);
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh recommendations'));
    } finally {
      setIsLoading(false);
    }
  }, [fetchRecommendations]);

  return {
    recommendations: data,
    data: data,
    isLoading,
    isFetchingNextPage,
    hasNextPage: data.length === limit,
    fetchNextPage,
    refetch,
    error,
  };
};

// ============================================================================
// HOOK: usePlayNext
// ============================================================================

export const usePlayNext = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback((track: any) => {
    setIsPending(true);
    setError(null);

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('PLAYER_PLAY_NEXT', {
          detail: { track }
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to play next'));
    } finally {
      setIsPending(false);
    }
  }, []);

  return {
    mutate,
    isPending,
    error,
  };
};

// ============================================================================
// HOOK: useAddToQueue
// ============================================================================

export const useAddToQueue = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback((track: any) => {
    setIsPending(true);
    setError(null);

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('PLAYER_ADD_TO_QUEUE', {
          detail: { track }
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to add to queue'));
    } finally {
      setIsPending(false);
    }
  }, []);

  return {
    mutate,
    isPending,
    error,
  };
};

// ============================================================================
// HOOK: useRadioStation
// ============================================================================

export const useRadioStation = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const manager = RadioStationManager.getInstance();

  const mutate = useCallback(async ({ seed, name }: { seed: string; name: string }) => {
    setIsPending(true);
    setError(null);

    try {
      const station = await manager.createStation(seed, name);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('PLAYER_RADIO_START', {
          detail: { station }
        }));
      }
      
      return station;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create radio station'));
      throw err;
    } finally {
      setIsPending(false);
    }
  }, []);

  return {
    mutate,
    isPending,
    error,
  };
};

// ============================================================================
// HOOK: useRecentlyPlayed
// ============================================================================

export const useRecentlyPlayed = () => {
  const [recentlyPlayed, setRecentlyPlayed] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const manager = RecentlyPlayedManager.getInstance();

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const items = await manager.getRecentlyPlayed();
        setRecentlyPlayed(items);
      } catch {
        // Use empty array
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const addToRecentlyPlayed = useCallback(async (track: any) => {
    await manager.addTrack(track);
    const updated = await manager.getRecentlyPlayed();
    setRecentlyPlayed(updated);
  }, []);

  const clearRecentlyPlayed = useCallback(async () => {
    await manager.clear();
    setRecentlyPlayed([]);
  }, []);

  return {
    recentlyPlayed,
    isLoading,
    addToRecentlyPlayed,
    clearRecentlyPlayed,
  };
};

// ============================================================================
// HOOK: useRecommendationSettings
// ============================================================================

export const useRecommendationSettings = () => {
  const [includeExplicit, setIncludeExplicit] = useState(true);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([]);
  const [diversityLevel, setDiversityLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await SecureStorage.getItem<{
          includeExplicit: boolean;
          preferredGenres: string[];
          diversityLevel: 'low' | 'medium' | 'high';
        }>(STORAGE_KEYS.USER_PREFERENCES);
        
        if (stored) {
          setIncludeExplicit(stored.includeExplicit ?? true);
          setPreferredGenres(stored.preferredGenres ?? []);
          setDiversityLevel(stored.diversityLevel ?? 'medium');
        }
      } catch {
        // Use defaults
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<{
    includeExplicit: boolean;
    preferredGenres: string[];
    diversityLevel: 'low' | 'medium' | 'high';
  }>) => {
    try {
      const settings = {
        includeExplicit,
        preferredGenres,
        diversityLevel,
        ...newSettings,
      };

      await SecureStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, settings);

      if (newSettings.includeExplicit !== undefined) setIncludeExplicit(newSettings.includeExplicit);
      if (newSettings.preferredGenres !== undefined) setPreferredGenres(newSettings.preferredGenres);
      if (newSettings.diversityLevel !== undefined) setDiversityLevel(newSettings.diversityLevel);
    } catch {
      // Silent fail
    }
  }, [includeExplicit, preferredGenres, diversityLevel]);

  return {
    includeExplicit,
    preferredGenres,
    diversityLevel,
    isLoading,
    updateSettings,
  };
};

const RecommendationEngine = {
  useRecommendations,
  usePlayNext,
  useAddToQueue,
  useRadioStation,
  useRecentlyPlayed,
  useRecommendationSettings,
};

export default RecommendationEngine;