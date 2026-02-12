// src/services/mavin/core/CacheLayer.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import Crypto from 'expo-crypto';

// Types
export interface CacheMetadata {
  url: string;
  format: '48kbps' | '70kbps' | '128kbps' | '160kbps';
  size: number;
  expiresAt: number;
  lastAccessed: number;
  accessCount: number;
  source: string;
  bitrate: number;
}

export interface CacheResult {
  url: string;
  metadata: CacheMetadata;
  cacheLayer: 'L1' | 'L2' | 'L3' | 'L4' | 'MISS';
  latency: number;
}

export interface CacheStats {
  hits: Record<'L1' | 'L2' | 'L3' | 'L4', number>;
  misses: number;
  avgLatency: number;
  storageUsed: number;
  itemsCached: number;
}

// Constants
const CACHE_CONFIG = {
  // L1: Device cache (AsyncStorage)
  L1_MAX_ITEMS: 100,
  L1_TTL: 24 * 60 * 60 * 1000, // 24 hours
  L1_MAX_SIZE: 100 * 1024 * 1024, // 100MB
  
  // L2: CDN cache (Cloudflare Workers)
  L2_ENDPOINT: 'https://cdn.mavin.global/v1/cache',
  L2_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // L3: Edge cache (Supabase Edge Functions)
  L3_ENDPOINT: 'https://edge.mavin.global/cache',
  L3_TTL: 30 * 24 * 60 * 60 * 1000, // 30 days
  
  // L4: IPFS decentralized cache
  L4_GATEWAY: 'https://ipfs.mavin.global/ipfs',
  L4_TTL: 365 * 24 * 60 * 60 * 1000, // 1 year
  
  // Global
  MAX_CACHE_ATTEMPTS: 3,
  PREFETCH_BATCH_SIZE: 20,
  CLEANUP_THRESHOLD: 0.8, // Clean when 80% full
} as const;

const STORAGE_KEYS = {
  CACHE_PREFIX: '@mavin/cache/',
  CACHE_INDEX: '@mavin/cache_index',
  CACHE_STATS: '@mavin/cache_stats',
  PRELOAD_COMPLETE: '@mavin/preload_complete',
} as const;

/**
 * Quadruple Cache Layer - L1→L2→L3→L4 hierarchy
 */
class CacheLayer {
  private static instance: CacheLayer;
  private stats: CacheStats = {
    hits: { L1: 0, L2: 0, L3: 0, L4: 0 },
    misses: 0,
    avgLatency: 0,
    storageUsed: 0,
    itemsCached: 0,
  };
  private cleanupInProgress = false;
  private preloadPromise: Promise<void> | null = null;

  private constructor() {
    this.loadStats();
    this.scheduleCleanup();
  }

  static getInstance(): CacheLayer {
    if (!CacheLayer.instance) {
      CacheLayer.instance = new CacheLayer();
    }
    return CacheLayer.instance;
  }

  // ==================== CORE CACHE RESOLUTION ====================

  /**
   * Main cache resolution: L1 → L2 → L3 → L4 → MISS
   */
  async resolve(songId: string, bitrate?: number): Promise<CacheResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(songId, bitrate);
    
    try {
      // L1: Device cache (0ms target)
      const l1Result = await this.checkL1(cacheKey);
      if (l1Result) {
        return this.createResult(l1Result, 'L1', startTime);
      }

      // L2: CDN cache (50ms target)
      const l2Result = await this.checkL2(cacheKey);
      if (l2Result) {
        await this.storeInL1(cacheKey, l2Result); // Populate L1
        return this.createResult(l2Result, 'L2', startTime);
      }

      // L3: Edge cache (100ms target)
      const l3Result = await this.checkL3(cacheKey);
      if (l3Result) {
        await this.storeInL1(cacheKey, l3Result); // Populate L1
        await this.storeInL2(cacheKey, l3Result); // Populate L2
        return this.createResult(l3Result, 'L3', startTime);
      }

      // L4: IPFS cache (300ms target)
      const l4Result = await this.checkL4(cacheKey);
      if (l4Result) {
        await this.storeInL1(cacheKey, l4Result); // Populate L1
        await this.storeInL2(cacheKey, l4Result); // Populate L2
        await this.storeInL3(cacheKey, l4Result); // Populate L3
        return this.createResult(l4Result, 'L4', startTime);
      }

      // Cache miss - trigger extraction
      this.stats.misses++;
      this.saveStats();
      
      return {
        url: '',
        metadata: this.createEmptyMetadata(songId),
        cacheLayer: 'MISS',
        latency: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Cache resolution failed:', error);
      return {
        url: '',
        metadata: this.createEmptyMetadata(songId),
        cacheLayer: 'MISS',
        latency: Date.now() - startTime,
      };
    }
  }

  // ==================== L1: DEVICE CACHE ====================

  private async checkL1(cacheKey: string): Promise<CacheMetadata | null> {
    try {
      const cached = await AsyncStorage.getItem(`${STORAGE_KEYS.CACHE_PREFIX}${cacheKey}`);
      
      if (!cached) return null;
      
      const metadata: CacheMetadata = JSON.parse(cached);
      
      // Check TTL
      if (metadata.expiresAt < Date.now()) {
        await this.removeFromL1(cacheKey);
        return null;
      }
      
      // Update access stats
      metadata.lastAccessed = Date.now();
      metadata.accessCount++;
      
      // Update in storage
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.CACHE_PREFIX}${cacheKey}`,
        JSON.stringify(metadata)
      );
      
      this.stats.hits.L1++;
      this.saveStats();
      
      return metadata;
    } catch (error) {
      console.error('L1 cache check failed:', error);
      return null;
    }
  }

  private async storeInL1(cacheKey: string, metadata: CacheMetadata): Promise<void> {
    try {
      // Check storage limit
      await this.ensureL1Space(metadata.size);
      
      // Set expiry
      metadata.expiresAt = Date.now() + CACHE_CONFIG.L1_TTL;
      metadata.lastAccessed = Date.now();
      metadata.accessCount = 1;
      
      await AsyncStorage.setItem(
        `${STORAGE_KEYS.CACHE_PREFIX}${cacheKey}`,
        JSON.stringify(metadata)
      );
      
      await this.updateCacheIndex(cacheKey, metadata);
      await this.updateStorageStats();
    } catch (error) {
      console.error('Failed to store in L1:', error);
    }
  }

  private async removeFromL1(cacheKey: string): Promise<void> {
    await AsyncStorage.removeItem(`${STORAGE_KEYS.CACHE_PREFIX}${cacheKey}`);
    await this.removeFromCacheIndex(cacheKey);
    await this.updateStorageStats();
  }

  // ==================== L2: CDN CACHE ====================

  private async checkL2(cacheKey: string): Promise<CacheMetadata | null> {
    try {
      const response = await fetch(`${CACHE_CONFIG.L2_ENDPOINT}/${cacheKey}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'max-age=0' },
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });
      
      if (response.status === 200) {
        const data = await response.json();
        this.stats.hits.L2++;
        this.saveStats();
        return data.metadata;
      }
      
      return null;
    } catch (error) {
      // Silently fail - proceed to L3
      return null;
    }
  }

  private async storeInL2(cacheKey: string, metadata: CacheMetadata): Promise<void> {
    try {
      await fetch(CACHE_CONFIG.L2_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: cacheKey,
          metadata: {
            ...metadata,
            expiresAt: Date.now() + CACHE_CONFIG.L2_TTL,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      // Non-critical - CDN cache is optional
    }
  }

  // ==================== L3: EDGE CACHE ====================

  private async checkL3(cacheKey: string): Promise<CacheMetadata | null> {
    try {
      const response = await fetch(`${CACHE_CONFIG.L3_ENDPOINT}/${cacheKey}`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3 second timeout
      });
      
      if (response.status === 200) {
        const data = await response.json();
        this.stats.hits.L3++;
        this.saveStats();
        return data.metadata;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private async storeInL3(cacheKey: string, metadata: CacheMetadata): Promise<void> {
    try {
      await fetch(CACHE_CONFIG.L3_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: cacheKey,
          metadata: {
            ...metadata,
            expiresAt: Date.now() + CACHE_CONFIG.L3_TTL,
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      // Non-critical
    }
  }

  // ==================== L4: IPFS CACHE ====================

  private async checkL4(cacheKey: string): Promise<CacheMetadata | null> {
    try {
      // Use content-based addressing
      const cid = await this.generateCID(cacheKey);
      const response = await fetch(`${CACHE_CONFIG.L4_GATEWAY}/${cid}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.status === 200) {
        const data = await response.json();
        this.stats.hits.L4++;
        this.saveStats();
        return data.metadata;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private async storeInL4(cacheKey: string, metadata: CacheMetadata): Promise<void> {
    try {
      const cid = await this.generateCID(cacheKey);
      await fetch(`${CACHE_CONFIG.L4_GATEWAY}/pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid,
          metadata: {
            ...metadata,
            expiresAt: Date.now() + CACHE_CONFIG.L4_TTL,
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch (error) {
      // Non-critical - IPFS is decentralized backup
    }
  }

  // ==================== CACHE MANAGEMENT ====================

  /**
   * Preload Global Top 100 into L1 cache on first launch
   */
  async preloadTop100(): Promise<void> {
    // Ensure only one preload operation at a time
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = (async () => {
      try {
        const alreadyPreloaded = await AsyncStorage.getItem(STORAGE_KEYS.PRELOAD_COMPLETE);
        if (alreadyPreloaded === 'true') {
          return;
        }

        // Fetch Global Top 100 metadata from edge
        const response = await fetch(`${CACHE_CONFIG.L3_ENDPOINT}/top100`);
        if (!response.ok) return;

        const top100: Array<{ id: string; bitrates: number[] }> = await response.json();
        
        // Preload first 20 most likely to be played
        const toPreload = top100.slice(0, CACHE_CONFIG.PREFETCH_BATCH_SIZE);
        
        for (const song of toPreload) {
          // Store metadata for each bitrate
          for (const bitrate of song.bitrates.slice(0, 2)) { // First 2 bitrates
            const cacheKey = this.generateCacheKey(song.id, bitrate);
            const metadata: CacheMetadata = {
              url: '', // Empty - will be populated on first actual request
              format: this.bitrateToFormat(bitrate),
              size: 0,
              expiresAt: Date.now() + CACHE_CONFIG.L1_TTL,
              lastAccessed: Date.now(),
              accessCount: 0,
              source: 'preload',
              bitrate,
            };
            
            await this.storeInL1(cacheKey, metadata);
          }
        }

        await AsyncStorage.setItem(STORAGE_KEYS.PRELOAD_COMPLETE, 'true');
        console.log('Preloaded Top 100 metadata into L1 cache');
      } catch (error) {
        console.error('Preload failed:', error);
      } finally {
        this.preloadPromise = null;
      }
    })();

    return this.preloadPromise;
  }

  /**
   * Store extracted URL in all cache layers
   */
  async cacheResult(
    songId: string,
    url: string,
    bitrate: number,
    source: string,
    size?: number
  ): Promise<void> {
    const cacheKey = this.generateCacheKey(songId, bitrate);
    const metadata: CacheMetadata = {
      url,
      format: this.bitrateToFormat(bitrate),
      size: size || this.estimateSize(bitrate),
      expiresAt: Date.now() + CACHE_CONFIG.L1_TTL,
      lastAccessed: Date.now(),
      accessCount: 1,
      source,
      bitrate,
    };

    // Store in all layers in parallel
    await Promise.all([
      this.storeInL1(cacheKey, metadata),
      this.storeInL2(cacheKey, metadata),
      this.storeInL3(cacheKey, metadata),
      this.storeInL4(cacheKey, metadata),
    ]);
  }

  /**
   * Clear cache based on conditions
   */
  async clearCache(options: {
    layer?: 'L1' | 'L2' | 'L3' | 'L4' | 'all';
    olderThan?: number;
    maxSize?: number;
  } = {}): Promise<number> {
    let cleared = 0;

    if (options.layer === 'L1' || options.layer === 'all' || !options.layer) {
      cleared += await this.clearL1Cache(options);
    }

    return cleared;
  }

  private async clearL1Cache(options: {
    olderThan?: number;
    maxSize?: number;
  }): Promise<number> {
    if (this.cleanupInProgress) return 0;
    
    this.cleanupInProgress = true;
    let cleared = 0;

    try {
      const index = await this.getCacheIndex();
      const now = Date.now();
      
      // Sort by last accessed (oldest first)
      const sorted = Object.entries(index).sort(([, a], [, b]) => 
        a.lastAccessed - b.lastAccessed
      );

      for (const [cacheKey, metadata] of sorted) {
        // Check age
        if (options.olderThan && now - metadata.lastAccessed < options.olderThan) {
          continue;
        }

        // Remove
        await AsyncStorage.removeItem(`${STORAGE_KEYS.CACHE_PREFIX}${cacheKey}`);
        delete index[cacheKey];
        cleared++;

        // Check size limit
        if (options.maxSize && this.stats.storageUsed <= options.maxSize) {
          break;
        }
      }

      // Save updated index
      await AsyncStorage.setItem(STORAGE_KEYS.CACHE_INDEX, JSON.stringify(index));
      await this.updateStorageStats();
      
    } finally {
      this.cleanupInProgress = false;
    }

    return cleared;
  }

  // ==================== UTILITY METHODS ====================

  private generateCacheKey(songId: string, bitrate?: number): string {
    const base = `song_${songId}`;
    if (!bitrate) return base;
    
    // Generate deterministic hash for cache key
    return `${base}_${bitrate}`;
  }

  private async generateCID(data: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data
    );
    return `bafy${hash.substring(0, 44)}`; // Simulated CIDv1
  }

  private bitrateToFormat(bitrate: number): CacheMetadata['format'] {
    if (bitrate <= 48) return '48kbps';
    if (bitrate <= 70) return '70kbps';
    if (bitrate <= 128) return '128kbps';
    return '160kbps';
  }

  private estimateSize(bitrate: number, durationSeconds: number = 180): number {
    // Rough estimate: bitrate * duration / 8 bits per byte
    return Math.floor((bitrate * 1000 * durationSeconds) / 8);
  }

  private createResult(
    metadata: CacheMetadata,
    layer: CacheResult['cacheLayer'],
    startTime: number
  ): CacheResult {
    return {
      url: metadata.url,
      metadata,
      cacheLayer: layer,
      latency: Date.now() - startTime,
    };
  }

  private createEmptyMetadata(songId: string): CacheMetadata {
    return {
      url: '',
      format: '128kbps',
      size: 0,
      expiresAt: 0,
      lastAccessed: 0,
      accessCount: 0,
      source: 'miss',
      bitrate: 128,
    };
  }

  private async ensureL1Space(requiredSize: number): Promise<void> {
    await this.updateStorageStats();
    
    const availableSpace = CACHE_CONFIG.L1_MAX_SIZE - this.stats.storageUsed;
    
    if (availableSpace < requiredSize || 
        this.stats.itemsCached >= CACHE_CONFIG.L1_MAX_ITEMS) {
      await this.clearL1Cache({
        maxSize: CACHE_CONFIG.L1_MAX_SIZE * 0.5, // Clear to 50% capacity
      });
    }
  }

  private async getCacheIndex(): Promise<Record<string, CacheMetadata>> {
    try {
      const index = await AsyncStorage.getItem(STORAGE_KEYS.CACHE_INDEX);
      return index ? JSON.parse(index) : {};
    } catch {
      return {};
    }
  }

  private async updateCacheIndex(cacheKey: string, metadata: CacheMetadata): Promise<void> {
    const index = await this.getCacheIndex();
    index[cacheKey] = metadata;
    await AsyncStorage.setItem(STORAGE_KEYS.CACHE_INDEX, JSON.stringify(index));
  }

  private async removeFromCacheIndex(cacheKey: string): Promise<void> {
    const index = await this.getCacheIndex();
    delete index[cacheKey];
    await AsyncStorage.setItem(STORAGE_KEYS.CACHE_INDEX, JSON.stringify(index));
  }

  private async updateStorageStats(): Promise<void> {
    const index = await this.getCacheIndex();
    
    let totalSize = 0;
    Object.values(index).forEach(metadata => {
      totalSize += metadata.size || 0;
    });

    this.stats.storageUsed = totalSize;
    this.stats.itemsCached = Object.keys(index).length;
    await this.saveStats();
  }

  private async loadStats(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.CACHE_STATS);
      if (saved) {
        this.stats = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Failed to load cache stats:', error);
    }
  }

  private async saveStats(): Promise<void> {
    try {
      // Update average latency
      const totalHits = Object.values(this.stats.hits).reduce((a, b) => a + b, 0);
      if (totalHits > 0) {
        // Simplified latency calculation
        this.stats.avgLatency = 
          (this.stats.hits.L1 * 0 + 
           this.stats.hits.L2 * 50 + 
           this.stats.hits.L3 * 100 + 
           this.stats.hits.L4 * 300) / totalHits;
      }

      await AsyncStorage.setItem(STORAGE_KEYS.CACHE_STATS, JSON.stringify(this.stats));
    } catch (error) {
      console.error('Failed to save cache stats:', error);
    }
  }

  private scheduleCleanup(): void {
    // Run cleanup every hour
    setInterval(async () => {
      await this.cleanupExpired();
    }, 60 * 60 * 1000);
  }

  private async cleanupExpired(): Promise<void> {
    try {
      const index = await this.getCacheIndex();
      const now = Date.now();
      let cleared = 0;

      for (const [cacheKey, metadata] of Object.entries(index)) {
        if (metadata.expiresAt < now) {
          await AsyncStorage.removeItem(`${STORAGE_KEYS.CACHE_PREFIX}${cacheKey}`);
          delete index[cacheKey];
          cleared++;
        }
      }

      if (cleared > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.CACHE_INDEX, JSON.stringify(index));
        await this.updateStorageStats();
        console.log(`Cleaned up ${cleared} expired cache entries`);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  // ==================== PUBLIC API ====================

  getStats(): CacheStats {
    return { ...this.stats };
  }

  async getHitRate(): Promise<number> {
    const totalHits = Object.values(this.stats.hits).reduce((a, b) => a + b, 0);
    const totalAttempts = totalHits + this.stats.misses;
    
    return totalAttempts > 0 ? totalHits / totalAttempts : 0;
  }

  async isCached(songId: string, bitrate?: number): Promise<boolean> {
    const cacheKey = this.generateCacheKey(songId, bitrate);
    const l1Result = await this.checkL1(cacheKey);
    return l1Result !== null;
  }
}

// ==================== REACT HOOKS ====================

/**
 * Hook for cache resolution with TanStack Query
 */
export function useCacheResolution(songId: string, bitrate?: number) {
  const cacheLayer = CacheLayer.getInstance();
  
  return useQuery({
    queryKey: ['cache-resolution', songId, bitrate],
    queryFn: () => cacheLayer.resolve(songId, bitrate),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    enabled: !!songId,
  });
}

/**
 * Hook for caching results
 */
export function useCacheResult() {
  const queryClient = useQueryClient();
  const cacheLayer = CacheLayer.getInstance();
  
  return useMutation({
    mutationFn: async (params: {
      songId: string;
      url: string;
      bitrate: number;
      source: string;
      size?: number;
    }) => {
      await cacheLayer.cacheResult(
        params.songId,
        params.url,
        params.bitrate,
        params.source,
        params.size
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate cache resolution query
      queryClient.invalidateQueries({ 
        queryKey: ['cache-resolution', variables.songId, variables.bitrate] 
      });
    },
  });
}

/**
 * Hook for cache management
 */
export function useCacheManagement() {
  const queryClient = useQueryClient();
  const cacheLayer = CacheLayer.getInstance();
  
  const clearMutation = useMutation({
    mutationFn: (options?: Parameters<typeof cacheLayer.clearCache>[0]) =>
      cacheLayer.clearCache(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cache-resolution'] });
    },
  });
  
  const preloadMutation = useMutation({
    mutationFn: () => cacheLayer.preloadTop100(),
  });
  
  const statsQuery = useQuery({
    queryKey: ['cache-stats'],
    queryFn: () => cacheLayer.getStats(),
    staleTime: 30 * 1000, // 30 seconds
  });
  
  return {
    clearCache: clearMutation.mutate,
    isClearing: clearMutation.isPending,
    preloadTop100: preloadMutation.mutate,
    isPreloading: preloadMutation.isPending,
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    refetchStats: statsQuery.refetch,
  };
}

// Export singleton instance
export const cacheLayer = CacheLayer.getInstance();
export default CacheLayer;