// src/cache/cache-manager.ts

import { deviceCache } from './device-cache';
import { supabaseCache } from './supabase-cache';
import { 
  searchKey, 
  trackKey, 
  streamKey 
} from './utils';
import { 
  TrackMetadata, 
  StreamSaveData,
  SearchResult,
  CacheStats,
  RelatedTrackInput
} from './types';
import { config } from './config';

/**
 * Cache Manager - Orchestrates L1 and L2
 * Single entry point for all cache operations
 */
export class CacheManager {
  private device = deviceCache;
  private supabase = supabaseCache;

  /**
   * ==================== SEARCH FLOW ====================
   */

  /**
   * Get search result
   * Order: Device → Supabase → null
   */
  public async getSearch(query: string): Promise<SearchResult | null> {
    console.log(`\n🔍 CacheManager.getSearch: "${query}"`);
    const key = searchKey(query);
    console.log('Cache key:', key);

    // 1. Try device cache (L1)
    console.log('Checking device cache...');
    const deviceResult = await this.device.get<SearchResult>(key);
    if (deviceResult) {
      console.log(`✅ Device cache hit: ${query}`);
      return {
        ...deviceResult,
        source: 'device'
      };
    }
    console.log('❌ Device cache miss');

    // 2. Try supabase (L2)
    console.log('Checking Supabase cache...');
    const track = await this.supabase.findBySearch(query);
    if (track && track.id) {
      console.log(`✅ Supabase cache hit: ${query}`);
      
      // Get stream
      const stream = await this.supabase.getStream(track.id);
      
      const result: SearchResult = {
        track,
        stream: stream || undefined,
        source: 'supabase'
      };

      // Save to device cache for next time (don't wait)
      console.log('Saving to device cache...');
      this.device.set(key, result).catch(console.error);

      return result;
    }

    // 3. Not found
    console.log(`❌ Cache miss: ${query}`);
    return null;
  }

  /**
   * Save search result to both caches
   */
  public async saveSearch(
    query: string, 
    trackData: TrackMetadata, 
    streamData: StreamSaveData
  ): Promise<boolean> {
    console.log(`\n💾 CacheManager.saveSearch: "${query}"`);
    
    // ✅ FIXED: Renamed from searchKey to cacheKey to avoid naming conflict
    const cacheKey = searchKey(query);
    console.log('Cache key:', cacheKey);
    
    // 1. Save track to Supabase
    console.log('Saving track to Supabase...');
    const trackId = await this.supabase.saveTrack(trackData);
    
    if (!trackId) {
      console.error('❌ Failed to save track to Supabase');
      return false;
    }
    console.log('✅ Track saved with ID:', trackId);

    // 2. Save stream to Supabase
    console.log('Saving stream to Supabase...');
    await this.supabase.saveStream({
      ...streamData,
      trackId
    });
    console.log('✅ Stream saved');

    // 3. Save search mapping
    console.log('Saving search mapping...');
    await this.supabase.saveSearch(query, trackId);
    console.log('✅ Search mapping saved');

    // 4. Save to device cache
    console.log('Saving to device cache...');
    const result: SearchResult = {
      track: { ...trackData, id: trackId },
      stream: {
        trackId,
        source: streamData.source,
        streamUrl: streamData.streamUrl,
        quality: streamData.quality || '128kbps',
        format: streamData.format || 'webm'
      },
      source: 'api'
    };
    
    await this.device.set(cacheKey, result);
    console.log('✅ Device cache saved');

    // 5. Trigger background caching of related tracks (don't wait)
    this.cacheRelatedTracks(trackId, trackData.artist, trackData.title).catch(console.error);

    return true;
  }

  /**
   * ==================== TRACK METHODS ====================
   */

  /**
   * Get track by ID
   */
  public async getTrack(trackId: string): Promise<TrackMetadata | null> {
    console.log(`\n🎵 CacheManager.getTrack: ${trackId}`);
    return await this.supabase.getTrack(trackId);
  }

  /**
   * Get track with stream
   */
  public async getTrackWithStream(trackId: string): Promise<{ track: TrackMetadata | null; stream: any | null }> {
    console.log(`\n🎵 CacheManager.getTrackWithStream: ${trackId}`);
    const [track, stream] = await Promise.all([
      this.supabase.getTrack(trackId),
      this.supabase.getStream(trackId)
    ]);

    return { track, stream };
  }

  /**
   * ==================== RELATED TRACKS ====================
   */

  /**
   * Cache related tracks (background job)
   */
  public async cacheRelatedTracks(
    trackId: string, 
    artist: string, 
    currentTitle: string
  ): Promise<void> {
    console.log(`\n🔄 Caching related tracks for: ${artist} - ${currentTitle}`);

    try {
      // This will call your API to get related tracks
      // You need to implement fetchRelatedTracks based on your API
      const relatedTracks = await this.fetchRelatedTracks(artist, currentTitle);
      
      if (relatedTracks && relatedTracks.length > 0) {
        await this.supabase.saveRelatedTracks(trackId, relatedTracks);
        console.log(`✅ Saved ${relatedTracks.length} related tracks`);
      } else {
        console.log('No related tracks found');
      }
    } catch (error) {
      console.error('❌ Cache related tracks error:', error);
    }
  }

  /**
   * Get related tracks for a track
   */
  public async getRelatedTracks(trackId: string, limit = 10): Promise<TrackMetadata[]> {
    console.log(`\n🔄 Getting related tracks for: ${trackId}`);
    
    // Try Supabase first
    const related = await this.supabase.getRelatedTracks(trackId, limit);
    
    if (related && related.length > 0) {
      console.log(`✅ Found ${related.length} related tracks from cache`);
      return related;
    }

    console.log('No related tracks found in cache');
    return [];
  }

  /**
   * ==================== ARTIST METHODS ====================
   */

  /**
   * Get artist discography
   */
  public async getArtistDiscography(artistName: string): Promise<any> {
    console.log(`\n👤 Getting artist discography: ${artistName}`);
    
    // Try cache first
    const cached = await this.supabase.getArtist(artistName);
    
    if (cached) {
      console.log('✅ Artist found in cache');
      return cached;
    }

    console.log('Artist not found in cache');
    return null;
  }

  /**
   * ==================== STREAM HEALTH ====================
   */

  /**
   * Report stream failure
   */
  public async reportStreamFailure(streamId: string): Promise<void> {
    console.log(`\n⚠️ Reporting stream failure: ${streamId}`);
    await this.supabase.reportStreamFailure(streamId);
  }

  /**
   * ==================== FETCH HELPERS ====================
   */

  /**
   * Fetch related tracks from API
   * Implement this based on your actual API
   */
  private async fetchRelatedTracks(
    artist: string, 
    currentTitle: string
  ): Promise<RelatedTrackInput[]> {
    console.log(`\n🌐 Fetching related tracks for ${artist} - ${currentTitle}`);
    
    // TODO: Implement actual API call to get related tracks
    // This could be from Spotify, YouTube, or your own recommendation engine
    
    // For now, return empty array
    // In production, you'd call your API here
    console.log('No related tracks API implemented yet');
    return [];
  }

  /**
   * ==================== STATS ====================
   */

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<CacheStats> {
    console.log('\n📊 Getting cache statistics');
    
    const deviceStats = this.device.getStats();
    const supabaseStats = await this.supabase.getStats();

    const stats = {
      device: deviceStats,
      supabase: supabaseStats,
      timestamp: new Date().toISOString()
    };
    
    console.log('📊 Stats:', JSON.stringify(stats, null, 2));
    return stats;
  }

  /**
   * Clear all caches
   */
  public async clearAll(): Promise<void> {
    console.log('\n🧹 Clearing all caches');
    await this.device.clear();
    console.log('✅ All caches cleared');
  }

  /**
   * Warm up cache with popular searches
   */
  public async warmCache(limit = 50): Promise<void> {
    console.log(`\n🔥 Warming cache with top ${limit} popular searches...`);
    
    const popular = await this.supabase.getPopularSearches(limit, 5);
    console.log(`Found ${popular.length} popular searches to warm`);
    
    for (const search of popular) {
      console.log(`Warming: "${search.query}"`);
      // This will trigger a cache refresh
      await this.getSearch(search.query);
    }
    
    console.log('✅ Cache warming complete');
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();