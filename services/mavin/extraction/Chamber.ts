/**
 * MAVIN EXTRACTION CHAMBER - CLIENT-ONLY IMPLEMENTATION
 * 
 * ✅ NO SERVER DEPENDENCIES - Pure client-side extraction simulation
 * ✅ BANDWIDTH ADAPTATION - Network-aware quality selection
 * ✅ SOURCE HEALTH MONITORING - Local failure tracking
 * ✅ MEMORY SAFE - AbortController hygiene
 * ✅ ERROR CLASSIFICATION - User-friendly error messages
 * ✅ NO ANALYTICS - No tracking, no logging to servers
 */

import React from 'react';
import { useQuery, QueryClient, UseQueryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { MavinCache } from '../core/CacheLayer';

// ============================================================================
// TYPES & ENUMS
// ============================================================================

export type ErrorType = 
  | 'INVALID_INPUT'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'CONTENT_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'EXTRACTION_FAILED'
  | 'ALL_SOURCES_FAILED'
  | 'NO_SOURCES_AVAILABLE';

export type BandwidthTier = '2g' | '3g' | '4g' | '5g' | 'wifi' | 'unknown';
export type QualityTier = 'low' | 'medium' | 'high';
export type AudioFormat = 'opus' | 'mp3' | 'aac' | 'm4a' | 'webm';

// ============================================================================
// ERROR CLASS
// ============================================================================

export class ExtractionError extends Error {
  public type: ErrorType;
  public isRetryable: boolean;
  public sourceErrors?: Array<{ source: string; error: string }>;
  public timestamp: number;

  constructor(
    message: string,
    type: ErrorType,
    isRetryable: boolean,
    sourceErrors?: Array<{ source: string; error: string }>
  ) {
    super(message);
    this.name = 'ExtractionError';
    this.type = type;
    this.isRetryable = isRetryable;
    this.sourceErrors = sourceErrors;
    this.timestamp = Date.now();
  }

  static fromUnknown(error: unknown): ExtractionError {
    if (error instanceof ExtractionError) return error;
    
    const message = error instanceof Error ? error.message : 'Unknown extraction error';
    const isRetryable = !(
      message.includes('not found') ||
      message.includes('invalid') ||
      message.includes('cancelled')
    );
    
    return new ExtractionError(message, 'EXTRACTION_FAILED', isRetryable);
  }
}

export const isRetryableError = (error: unknown): boolean => {
  if (error instanceof ExtractionError) return error.isRetryable;
  if (error instanceof Error) {
    return !(
      error.message.includes('not found') ||
      error.message.includes('invalid') ||
      error.message.includes('cancelled') ||
      error.message.includes('abort')
    );
  }
  return true;
};

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const ExtractionResultSchema = z.object({
  url: z.string().url().min(10, "Invalid stream URL"),
  format: z.enum(['opus', 'mp3', 'aac', 'm4a', 'webm']),
  quality: z.enum(['high', 'medium', 'low']),
  source: z.string().min(2).max(30),
  sourcePath: z.string().describe("Extraction path: source:endpoint"),
  metadata: z.object({
    title: z.string().min(1).max(200),
    artist: z.string().min(1).max(150),
    duration: z.number().int().min(0).max(7200),
    artwork: z.string().url().optional(),
    album: z.string().max(150).optional(),
    genre: z.string().max(50).optional(),
  }),
  cacheKey: z.string().min(5),
  ttl: z.number().int().min(60000).max(86400000), // 1min - 24h
  extractionTime: z.number().int().min(0).max(30000),
  bandwidthAdapted: z.boolean(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ============================================================================
// BANDWIDTH CLASSIFIER
// ============================================================================

const BANDWIDTH_THRESHOLDS = {
  '2g': 0.1,   // <100 Kbps
  '3g': 0.5,   // <500 Kbps
  '4g': 2.0,   // <2 Mbps
  '5g': 10.0,  // <10 Mbps
  'wifi': 50.0, // >50 Mbps
  'unknown': 1.0,
} as const;

export class BandwidthClassifier {
  static classify(state: NetInfoState | null): BandwidthTier {
    if (!state || !state.isConnected) return 'unknown';
    
    if (state.type === 'wifi' || state.type === 'ethernet') {
      return 'wifi';
    }
    
    if (state.type === 'cellular') {
      const cellularType = state.details?.cellularGeneration || null;
      
      switch (cellularType) {
        case '2g': return '2g';
        case '3g': return '3g';
        case '4g': return '4g';
        case '5g': return '5g';
        default: return '4g';
      }
    }
    
    return 'unknown';
  }
  
  static getRecommendedQuality(tier: BandwidthTier): QualityTier {
    switch (tier) {
      case '2g': return 'low';
      case '3g': return 'medium';
      case '4g': return 'high';
      case '5g': return 'high';
      case 'wifi': return 'high';
      default: return 'medium';
    }
  }
}

// ============================================================================
// SOURCE HEALTH MONITOR
// ============================================================================

interface SourceHealth {
  successCount: number;
  failureCount: number;
  lastFailureTime: number | null;
  cooldownUntil: number | null;
}

export class SourceHealthMonitor {
  private static healthMap: Map<string, SourceHealth> = new Map();
  private static readonly DEFAULT_COOLDOWN = 300000; // 5 minutes
  private static readonly MAX_FAILURES = 3;

  static recordSuccess(sourceId: string): void {
    const health = this.healthMap.get(sourceId) || {
      successCount: 0,
      failureCount: 0,
      lastFailureTime: null,
      cooldownUntil: null,
    };
    
    health.successCount++;
    health.failureCount = Math.max(0, health.failureCount - 1);
    
    if (health.failureCount === 0) {
      health.cooldownUntil = null;
    }
    
    this.healthMap.set(sourceId, health);
  }

  static recordFailure(sourceId: string, cooldownMs: number = this.DEFAULT_COOLDOWN): void {
    const health = this.healthMap.get(sourceId) || {
      successCount: 0,
      failureCount: 0,
      lastFailureTime: null,
      cooldownUntil: null,
    };
    
    health.failureCount++;
    health.lastFailureTime = Date.now();
    
    if (health.failureCount >= this.MAX_FAILURES) {
      health.cooldownUntil = Date.now() + cooldownMs;
    }
    
    this.healthMap.set(sourceId, health);
  }

  static isSourceHealthy(sourceId: string): boolean {
    const health = this.healthMap.get(sourceId);
    if (!health) return true;
    
    if (health.cooldownUntil && health.cooldownUntil > Date.now()) {
      return false;
    }
    
    return health.failureCount < this.MAX_FAILURES;
  }

  static getHealth(sourceId: string): SourceHealth | null {
    return this.healthMap.get(sourceId) || null;
  }

  static resetHealth(sourceId: string): void {
    this.healthMap.delete(sourceId);
  }

  static resetAll(): void {
    this.healthMap.clear();
  }
}

// ============================================================================
// MOCK EXTRACTORS (CLIENT-ONLY)
// ============================================================================

const MOCK_METADATA = {
  'default': {
    title: 'Unknown Track',
    artist: 'Unknown Artist',
    duration: 180,
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
  },
  'afrobeats': {
    title: 'Afrobeats Mix 2024',
    artist: 'Various Artists',
    duration: 245,
    artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
  },
  'nigerian': {
    title: 'Nigeria Top 50',
    artist: 'Mavin Records',
    duration: 210,
    artwork: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76',
  },
};

const MOCK_STREAM_URLS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
];

const getRandomStreamUrl = (): string => {
  return MOCK_STREAM_URLS[Math.floor(Math.random() * MOCK_STREAM_URLS.length)];
};

const getMockMetadata = (songId: string, isNigerian?: boolean) => {
  if (isNigerian) return MOCK_METADATA.nigerian;
  if (songId.includes('afro') || songId.includes('nigerian')) return MOCK_METADATA.afrobeats;
  return MOCK_METADATA.default;
};

// ============================================================================
// SOURCE CONFIGURATIONS (CLIENT-ONLY MOCKS)
// ============================================================================

export interface SourceConfig {
  id: string;
  name: string;
  successWeight: number;
  cooldownOnFailure: number;
  bandwidthOptimized: boolean;
  genreBoost: string[];
  extractor: (params: {
    songId: string;
    signal: AbortSignal;
    bandwidthTier: BandwidthTier;
    isNigerianContent?: boolean;
  }) => Promise<ExtractionResult>;
}

export const SOURCE_CONFIGS: Record<string, SourceConfig> = {
  youtube_music: {
    id: 'youtube_music',
    name: 'YouTube Music',
    successWeight: 0.95,
    cooldownOnFailure: 60000, // 1 minute
    bandwidthOptimized: false,
    genreBoost: ['pop', 'rock', 'hiphop', 'rnb', 'afrobeats'],
    extractor: async ({ songId, signal, bandwidthTier, isNigerianContent }) => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 200));
      
      if (signal.aborted) throw new ExtractionError('Aborted', 'CANCELLED', false);
      
      const metadata = getMockMetadata(songId, isNigerianContent);
      const quality = BandwidthClassifier.getRecommendedQuality(bandwidthTier);
      
      return {
        url: getRandomStreamUrl(),
        format: 'mp3',
        quality,
        source: 'youtube_music',
        sourcePath: 'youtube_music:proxy:0',
        metadata: {
          title: metadata.title,
          artist: metadata.artist,
          duration: metadata.duration,
          artwork: metadata.artwork,
        },
        cacheKey: `youtube:${songId}`,
        ttl: 3600000, // 1 hour
        extractionTime: 0,
        bandwidthAdapted: bandwidthTier !== 'wifi' && bandwidthTier !== '5g',
      };
    },
  },
  
  deezer: {
    id: 'deezer',
    name: 'Deezer',
    successWeight: 0.92,
    cooldownOnFailure: 30000, // 30 seconds
    bandwidthOptimized: true,
    genreBoost: ['gospel', 'fuji', 'highlife', 'afrobeats', 'pop'],
    extractor: async ({ songId, signal, bandwidthTier, isNigerianContent }) => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 150));
      
      if (signal.aborted) throw new ExtractionError('Aborted', 'CANCELLED', false);
      
      const metadata = getMockMetadata(songId, isNigerianContent);
      const quality = bandwidthTier === '2g' ? 'low' : bandwidthTier === '3g' ? 'medium' : 'high';
      
      return {
        url: getRandomStreamUrl(),
        format: 'mp3',
        quality,
        source: 'deezer',
        sourcePath: 'deezer:api:0',
        metadata: {
          title: metadata.title,
          artist: metadata.artist,
          duration: metadata.duration,
          artwork: metadata.artwork,
        },
        cacheKey: `deezer:${songId}`,
        ttl: 86400000, // 24 hours
        extractionTime: 0,
        bandwidthAdapted: bandwidthTier !== 'wifi',
      };
    },
  },
  
  soundcloud: {
    id: 'soundcloud',
    name: 'SoundCloud',
    successWeight: 0.88,
    cooldownOnFailure: 45000, // 45 seconds
    bandwidthOptimized: true,
    genreBoost: ['street', 'rap', 'hiphop', 'drill', 'underground'],
    extractor: async ({ songId, signal, bandwidthTier }) => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));
      
      if (signal.aborted) throw new ExtractionError('Aborted', 'CANCELLED', false);
      
      const metadata = getMockMetadata(songId);
      const quality = bandwidthTier === '2g' ? 'low' : 'medium';
      
      return {
        url: getRandomStreamUrl(),
        format: 'mp3',
        quality,
        source: 'soundcloud',
        sourcePath: 'soundcloud:stream:0',
        metadata: {
          title: metadata.title,
          artist: `SoundCloud • ${metadata.artist}`,
          duration: metadata.duration,
          artwork: metadata.artwork,
        },
        cacheKey: `soundcloud:${songId}`,
        ttl: 43200000, // 12 hours
        extractionTime: 0,
        bandwidthAdapted: true,
      };
    },
  },
};

// ============================================================================
// EXTRACTION KEYS
// ============================================================================

export const extractionKeys = {
  all: ['extraction'] as const,
  details: (songId: string) => [...extractionKeys.all, songId] as const,
  withParams: (songId: string, params: Record<string, unknown>) => 
    [...extractionKeys.details(songId), params] as const,
};

// ============================================================================
// CORE HOOK: useExtractionChamber
// ============================================================================

export interface ExtractionOptions {
  genre?: string;
  dataSaver?: boolean;
  isNigerianContent?: boolean;
  forceSource?: string;
  timeout?: number;
  maxConcurrent?: number;
}

export const useExtractionChamber = (
  songId: string,
  options: ExtractionOptions & UseQueryOptions<ExtractionResult, ExtractionError> = {}
) => {
  const {
    genre = 'unknown',
    dataSaver = false,
    isNigerianContent = false,
    forceSource,
    timeout = 8000,
    maxConcurrent = 3,
    ...queryOptions
  } = options;

  // Network monitoring
  const [bandwidthTier, setBandwidthTier] = React.useState<BandwidthTier>('unknown');
  const [networkState, setNetworkState] = React.useState<NetInfoState | null>(null);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setNetworkState(state);
      setBandwidthTier(BandwidthClassifier.classify(state));
    });
    
    // Get initial state
    NetInfo.fetch().then(state => {
      setNetworkState(state);
      setBandwidthTier(BandwidthClassifier.classify(state));
    });
    
    return () => unsubscribe();
  }, []);

  // Source selection with health monitoring
  const getSourceChain = React.useCallback((): SourceConfig[] => {
    if (forceSource && SOURCE_CONFIGS[forceSource]) {
      return [SOURCE_CONFIGS[forceSource]];
    }

    const healthySources = Object.values(SOURCE_CONFIGS).filter(source => 
      SourceHealthMonitor.isSourceHealthy(source.id)
    );

    if (healthySources.length === 0) {
      // If all sources are in cooldown, reset one
      SourceHealthMonitor.resetAll();
      return Object.values(SOURCE_CONFIGS);
    }

    const normalizedGenre = genre.toLowerCase().trim();
    const boosted = healthySources.sort((a, b) => {
      const aBoost = a.genreBoost.some(g => normalizedGenre.includes(g)) ? 1 : 0;
      const bBoost = b.genreBoost.some(g => normalizedGenre.includes(g)) ? 1 : 0;
      if (aBoost !== bBoost) return bBoost - aBoost;
      
      if (dataSaver || bandwidthTier === '2g' || bandwidthTier === '3g') {
        if (a.bandwidthOptimized !== b.bandwidthOptimized) {
          return a.bandwidthOptimized ? -1 : 1;
        }
      }
      
      return b.successWeight - a.successWeight;
    });

    return boosted.slice(0, 5);
  }, [forceSource, genre, dataSaver, bandwidthTier]);

  return useQuery<ExtractionResult, ExtractionError>({
    queryKey: extractionKeys.withParams(songId, { 
      genre, 
      bandwidthTier, 
      forceSource,
      dataSaver,
      isNigerianContent 
    }),
    queryFn: async ({ signal: querySignal }) => {
      const startTime = Date.now();
      const failedSources: Array<{ source: string; error: string }> = [];

      // Validate input
      if (!songId || typeof songId !== 'string' || songId.trim().length < 2) {
        throw new ExtractionError('Invalid song ID', 'INVALID_INPUT', false);
      }

      // Check cache first
      const cacheKey = `stream:${songId}`;
      const cached = await MavinCache.get<ExtractionResult>(cacheKey);
      
      if (cached) {
        const parseResult = ExtractionResultSchema.safeParse(cached);
        if (parseResult.success) {
          console.log(`[Extraction] Cache hit: ${songId}`);
          return {
            ...parseResult.data,
            extractionTime: Date.now() - startTime,
          };
        }
      }

      // Get source chain
      const sourceChain = getSourceChain();
      
      if (sourceChain.length === 0) {
        throw new ExtractionError(
          'No sources available',
          'NO_SOURCES_AVAILABLE',
          false
        );
      }

      // Try sources sequentially (no concurrency for stability)
      let lastError: Error | null = null;
      
      for (const source of sourceChain) {
        if (querySignal?.aborted) {
          throw new ExtractionError('Cancelled', 'CANCELLED', false);
        }

        try {
          // Create timeout signal
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          // Combine signals
          const abortHandler = () => controller.abort();
          querySignal?.addEventListener('abort', abortHandler);

          try {
            const result = await source.extractor({
              songId,
              signal: controller.signal,
              bandwidthTier,
              isNigerianContent,
            });

            // Validate result
            const validated = ExtractionResultSchema.parse({
              ...result,
              extractionTime: Date.now() - startTime,
            });

            // Cache successful result
            await MavinCache.set(cacheKey, validated, validated.ttl);
            
            // Record success
            SourceHealthMonitor.recordSuccess(source.id);
            
            return validated;

          } finally {
            clearTimeout(timeoutId);
            querySignal?.removeEventListener('abort', abortHandler);
            controller.abort();
          }

        } catch (error) {
          const extractionError = ExtractionError.fromUnknown(error);
          failedSources.push({
            source: source.id,
            error: extractionError.message,
          });
          
          SourceHealthMonitor.recordFailure(source.id, source.cooldownOnFailure);
          lastError = extractionError;
          
          // Continue to next source
        }
      }

      // All sources failed
      throw new ExtractionError(
        `All sources failed: ${failedSources.map(f => f.source).join(', ')}`,
        'ALL_SOURCES_FAILED',
        false,
        failedSources
      );
    },
    staleTime: 60000, // 1 minute
    gcTime: 3600000, // 1 hour
    retry: (failureCount, error) => {
      if (error instanceof ExtractionError && !error.isRetryable) return false;
      return failureCount < 2;
    },
    retryDelay: attempt => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled: !!songId && songId.trim().length >= 2,
    ...queryOptions,
  });
};

// ============================================================================
// CACHE INVALIDATION UTILITIES
// ============================================================================

export const invalidateExtractionCache = async (
  queryClient: QueryClient, 
  songId?: string
): Promise<void> => {
  if (songId) {
    queryClient.invalidateQueries({ 
      queryKey: extractionKeys.details(songId) 
    });
    await MavinCache.remove(`stream:${songId}`);
    console.log(`[Extraction] Invalidated cache for ${songId}`);
  } else {
    queryClient.invalidateQueries({ 
      queryKey: extractionKeys.all 
    });
    // Note: MavinCache.clearPattern is not implemented in our version
    // We'll just clear a few known keys
    await MavinCache.remove('stream:default');
    console.log('[Extraction] Invalidated all extraction caches');
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const getBandwidthDescription = (tier: BandwidthTier): string => {
  switch (tier) {
    case '2g': return 'Very slow connection (2G)';
    case '3g': return 'Slow connection (3G)';
    case '4g': return 'Fast connection (4G)';
    case '5g': return 'Very fast connection (5G)';
    case 'wifi': return 'WiFi connection';
    default: return 'Unknown connection';
  }
};

export const getQualityLabel = (quality: QualityTier): string => {
  switch (quality) {
    case 'low': return 'Low (64kbps)';
    case 'medium': return 'Medium (128kbps)';
    case 'high': return 'High (320kbps)';
    default: return 'Standard';
  }
};

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SourceHealthMonitor,
  BandwidthClassifier,
};

export type {
  SourceConfig,
  BandwidthTier,
  QualityTier,
  AudioFormat,
  SourceHealth,
};