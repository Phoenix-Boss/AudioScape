// libs/cache/supabase-cache.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  TrackMetadata, 
  StreamData, 
  StreamSaveData,
  RelatedTrackInput,
  ArtistCache,
  SupabaseStats,
  TrackIdentifier
} from './types';
import { normalizeQuery } from './utils';

/**
 * Supabase Cache - Persistent storage
 * Reads env variables at RUNTIME, not from static config
 */
export class SupabaseCache {
  private supabase: SupabaseClient | null = null;
  private enabled: boolean = false;
  private ttl: number = 2592000; // 30 days default

  constructor() {
    console.log('\n🏗️ ==================================');
    console.log('🏗️ SupabaseCache constructor starting...');
    console.log('=====================================\n');

    // ✅ READ ENV AT RUNTIME — NOT FROM CONFIG FILE
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    console.log('📋 Environment check at constructor:');
    console.log('  URL:', url ? '✅ Present' : '❌ Missing');
    console.log('  Anon Key:', anonKey ? '✅ Present' : '❌ Missing');
    console.log('  Service Key:', serviceKey ? '✅ Present' : '❌ Missing');

    if (!url || !anonKey) {
      console.error('❌ Supabase env variables missing');
      console.error('   URL:', url || 'undefined');
      console.error('   Anon Key:', anonKey || 'undefined');
      this.enabled = false;
      return;
    }

    this.enabled = true;

    try {
      const keyToUse = serviceKey || anonKey;

      console.log('🔧 Creating Supabase client with URL:', url);

      this.supabase = createClient(url, keyToUse, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

      console.log('✅ Supabase client created successfully');
      
      // Test connection in background
      this.testConnection().catch(err => {
        console.warn('⚠️ Supabase connection test failed:', err.message);
      });
      
    } catch (error) {
      console.error('❌ Failed to create Supabase client:', error);
      this.supabase = null;
      this.enabled = false;
    }

    console.log(`📊 SupabaseCache initialized:`);
    console.log(`   Enabled: ${this.enabled ? '✅' : '❌'}`);
    console.log(`   Client: ${this.supabase ? '✅ Created' : '❌ Not created'}`);
    console.log('🏗️ ==================================\n');
  }

  /**
   * Test database connection
   */
  private async testConnection(): Promise<void> {
    if (!this.supabase || !this.enabled) return;
    
    try {
      const { error } = await this.supabase
        .from('tracks')
        .select('count', { count: 'exact', head: true });
      
      if (error) {
        console.warn('⚠️ Supabase connection test failed:', error.message);
      } else {
        console.log('✅ Supabase connection successful');
      }
    } catch (error) {
      console.warn('⚠️ Supabase connection test error:', error);
    }
  }

  /**
   * ==================== TRACK METHODS ====================
   */

  /**
   * Get track by ID, ISRC, or title+artist
   */
  public async getTrack(identifier: string | TrackIdentifier): Promise<TrackMetadata | null> {
    console.log('\n🔍 ==================================');
    console.log('🔍 getTrack called');
    console.log('=====================================');
    console.log('Identifier:', JSON.stringify(identifier, null, 2));
    
    if (!this.enabled) {
      console.log('⚠️ Supabase cache disabled, returning null');
      return null;
    }

    if (!this.supabase) {
      console.error('❌ Supabase client not initialized');
      return null;
    }

    try {
      let query = this.supabase.from('tracks').select('*');

      if (typeof identifier === 'string') {
        console.log('   Searching by ID string:', identifier);
        query = query.eq('id', identifier);
      } else if (identifier.isrc) {
        console.log('   Searching by ISRC:', identifier.isrc);
        query = query.eq('isrc', identifier.isrc);
      } else if (identifier.title && identifier.artist) {
        console.log('   Searching by title+artist:', identifier.title, identifier.artist);
        query = query
          .eq('title', identifier.title)
          .eq('artist', identifier.artist);
      } else if (identifier.id) {
        console.log('   Searching by ID object:', identifier.id);
        query = query.eq('id', identifier.id);
      } else {
        console.log('❌ No valid identifier provided');
        return null;
      }

      console.log('   Executing query...');
      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('❌ Query error:', error);
        return null;
      }

      if (!data) {
        console.log('   No track found');
        return null;
      }

      console.log('✅ Track found:', {
        id: data.id,
        title: data.title,
        artist: data.artist
      });

      // Update access count in background
      this.updateTrackAccess(data.id).catch(console.error);

      // Convert from snake_case to camelCase
      const track: TrackMetadata = {
        id: data.id,
        isrc: data.isrc,
        title: data.title,
        artist: data.artist,
        album: data.album,
        duration: data.duration,
        artworkUrl: data.artwork_url,
        spotifyId: data.spotify_id,
        youtubeId: data.youtube_id,
        deezerId: data.deezer_id,
        soundcloudId: data.soundcloud_id,
        metadata: data.metadata,
        accessCount: data.access_count,
        lastAccessed: data.last_accessed,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };

      console.log('   Converted track:', track.title);
      return track;
    } catch (error) {
      console.error('❌ Get track error:', error);
      return null;
    }
  }

  /**
   * Save track to database
   */
  public async saveTrack(trackData: TrackMetadata): Promise<string | null> {
    console.log('\n💾 ==================================');
    console.log('💾 saveTrack called');
    console.log('=====================================');
    console.log('Track data:', {
      title: trackData.title,
      artist: trackData.artist,
      album: trackData.album,
      isrc: trackData.isrc
    });
    
    if (!this.enabled) {
      console.log('⚠️ Supabase cache disabled, returning null');
      return null;
    }

    if (!this.supabase) {
      console.error('❌ Supabase client not initialized');
      return null;
    }

    try {
      // Check if exists first
      console.log('   Checking if track exists...');
      const existing = await this.getTrack({
        isrc: trackData.isrc,
        title: trackData.title,
        artist: trackData.artist
      });

      if (existing && existing.id) {
        console.log('   Track exists, updating:', existing.id);
        
        // Update existing
        const { data, error } = await this.supabase
          .from('tracks')
          .update({
            isrc: trackData.isrc,
            title: trackData.title,
            artist: trackData.artist,
            album: trackData.album,
            duration: trackData.duration,
            artwork_url: trackData.artworkUrl,
            spotify_id: trackData.spotifyId,
            youtube_id: trackData.youtubeId,
            deezer_id: trackData.deezerId,
            soundcloud_id: trackData.soundcloudId,
            metadata: trackData.metadata || {},
            last_accessed: new Date().toISOString(),
            access_count: existing.accessCount ? existing.accessCount + 1 : 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select('id')
          .single();

        if (error) {
          console.error('❌ Update track error:', error);
          return existing.id;
        }

        console.log('✅ Track updated:', data.id);
        return data.id;
      }

      console.log('   Track does not exist, creating new...');
      
      // Insert new
      const insertData = {
        isrc: trackData.isrc,
        title: trackData.title,
        artist: trackData.artist,
        album: trackData.album,
        duration: trackData.duration,
        artwork_url: trackData.artworkUrl,
        spotify_id: trackData.spotifyId,
        youtube_id: trackData.youtubeId,
        deezer_id: trackData.deezerId,
        soundcloud_id: trackData.soundcloudId,
        metadata: trackData.metadata || {},
        last_accessed: new Date().toISOString(),
        access_count: 1,
        created_at: new Date().toISOString()
      };

      console.log('   Insert data:', insertData);

      const { data, error } = await this.supabase
        .from('tracks')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        console.error('❌ Save track error:', error);
        return null;
      }

      console.log('✅ New track created:', data.id);
      return data.id;
    } catch (error) {
      console.error('❌ Save track error:', error);
      return null;
    }
  }

  /**
   * Update track access count
   */
  private async updateTrackAccess(trackId: string): Promise<void> {
    try {
      if (!this.supabase) return;
      
      await this.supabase.rpc('increment_track_access', {
        track_id: trackId
      });
      console.log(`   Access count incremented for track ${trackId}`);
    } catch (error) {
      console.error('❌ Update track access error:', error);
    }
  }

  /**
   * ==================== STREAM METHODS ====================
   */

  /**
   * Get working stream for track
   */
  public async getStream(trackId: string): Promise<StreamData | null> {
    console.log(`\n🎵 Getting stream for track: ${trackId}`);
    
    if (!this.enabled || !this.supabase) {
      console.log('⚠️ Supabase cache disabled or client missing');
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('streams')
        .select('*')
        .eq('track_id', trackId)
        .eq('is_active', true)
        .order('health_score', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Get stream error:', error);
        return null;
      }

      if (!data) {
        console.log('   No stream found');
        return null;
      }

      // Check if expired
      if (new Date(data.expiry) < new Date()) {
        console.log('⏰ Stream expired, deactivating...');
        await this.supabase
          .from('streams')
          .update({ is_active: false })
          .eq('id', data.id);
        return null;
      }

      console.log('✅ Stream found:', {
        id: data.id,
        source: data.source,
        quality: data.quality,
        health: data.health_score
      });

      return {
        id: data.id,
        trackId: data.track_id,
        source: data.source,
        streamUrl: data.stream_url,
        quality: data.quality,
        format: data.format,
        expiry: data.expiry,
        isActive: data.is_active,
        healthScore: data.health_score,
        failureCount: data.failure_count,
        lastVerified: data.last_verified
      };
    } catch (error) {
      console.error('❌ Get stream error:', error);
      return null;
    }
  }

  /**
   * Save stream URL
   */
  public async saveStream(streamData: StreamSaveData): Promise<boolean> {
    console.log(`\n💾 Saving stream for track: ${streamData.trackId}`);
    
    if (!this.enabled || !this.supabase) return false;

    try {
      const expiryDate = new Date(
        Date.now() + (6 * 60 * 60 * 1000) // 6 hours default
      ).toISOString();

      // Check if exists
      const { data: existing } = await this.supabase
        .from('streams')
        .select('id')
        .eq('track_id', streamData.trackId)
        .eq('source', streamData.source)
        .maybeSingle();

      if (existing) {
        console.log('   Updating existing stream:', existing.id);
        
        // Update
        const { error } = await this.supabase
          .from('streams')
          .update({
            stream_url: streamData.streamUrl,
            quality: streamData.quality || '128kbps',
            format: streamData.format || 'webm',
            expiry: expiryDate,
            is_active: true,
            health_score: 100,
            last_verified: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) {
          console.error('❌ Update stream error:', error);
          return false;
        }
        
        console.log('✅ Stream updated');
        return true;
      }

      console.log('   Creating new stream...');
      
      // Insert
      const { error } = await this.supabase
        .from('streams')
        .insert({
          track_id: streamData.trackId,
          source: streamData.source,
          stream_url: streamData.streamUrl,
          quality: streamData.quality || '128kbps',
          format: streamData.format || 'webm',
          expiry: expiryDate,
          is_active: true,
          health_score: 100,
          last_verified: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Insert stream error:', error);
        return false;
      }

      console.log('✅ New stream created');
      return true;
    } catch (error) {
      console.error('❌ Save stream error:', error);
      return false;
    }
  }

  /**
   * Report failed stream
   */
  public async reportStreamFailure(streamId: string): Promise<void> {
    console.log(`\n⚠️ Reporting stream failure: ${streamId}`);
    
    if (!this.supabase) return;

    try {
      const { data } = await this.supabase
        .from('streams')
        .select('health_score, failure_count')
        .eq('id', streamId)
        .single();

      if (data) {
        const newHealth = data.health_score - 20;
        const newFailures = (data.failure_count || 0) + 1;

        console.log(`   Health: ${data.health_score} -> ${newHealth}`);
        console.log(`   Failures: ${data.failure_count || 0} -> ${newFailures}`);

        if (newHealth <= 0 || newFailures >= 3) {
          console.log('   Deactivating stream (too many failures)');
          // Deactivate
          await this.supabase
            .from('streams')
            .update({
              is_active: false,
              health_score: 0,
              failure_count: newFailures
            })
            .eq('id', streamId);
        } else {
          // Just reduce health
          await this.supabase
            .from('streams')
            .update({
              health_score: newHealth,
              failure_count: newFailures
            })
            .eq('id', streamId);
        }
      }
    } catch (error) {
      console.error('❌ Report stream failure error:', error);
    }
  }

  /**
   * ==================== SEARCH METHODS ====================
   */

  /**
   * Save search query and result
   */
  public async saveSearch(query: string, trackId: string): Promise<boolean> {
    console.log(`\n🔎 Saving search: "${query}" -> track: ${trackId}`);
    
    if (!this.enabled || !this.supabase) return false;

    const normalized = normalizeQuery(query);

    try {
      // Check if exists
      const { data: existing } = await this.supabase
        .from('searches')
        .select('id, hit_count')
        .eq('normalized', normalized)
        .maybeSingle();

      if (existing) {
        console.log('   Updating existing search, hit count:', existing.hit_count + 1);
        
        // Update hit count
        await this.supabase
          .from('searches')
          .update({
            hit_count: existing.hit_count + 1,
            last_hit: new Date().toISOString(),
            track_id: trackId
          })
          .eq('id', existing.id);
      } else {
        console.log('   Creating new search entry');
        
        // Insert
        await this.supabase
          .from('searches')
          .insert({
            query: query,
            normalized: normalized,
            track_id: trackId,
            hit_count: 1,
            first_seen: new Date().toISOString(),
            last_hit: new Date().toISOString()
          });
      }

      console.log('✅ Search saved');
      return true;
    } catch (error) {
      console.error('❌ Save search error:', error);
      return false;
    }
  }

  /**
   * Find track by search query
   */
  public async findBySearch(query: string): Promise<TrackMetadata | null> {
    console.log(`\n🔎 Finding by search: "${query}"`);
    
    if (!this.enabled || !this.supabase) return null;

    const normalized = normalizeQuery(query);

    try {
      const { data, error } = await this.supabase
        .from('searches')
        .select('track_id')
        .eq('normalized', normalized)
        .maybeSingle();

      if (error || !data || !data.track_id) {
        console.log('   No search record found');
        return null;
      }

      console.log('   Found search record, track_id:', data.track_id);

      // Update last hit
      await this.supabase
        .from('searches')
        .update({ last_hit: new Date().toISOString() })
        .eq('normalized', normalized);

      // Get the track
      return await this.getTrack(data.track_id);
    } catch (error) {
      console.error('❌ Find by search error:', error);
      return null;
    }
  }

  /**
   * ==================== RELATED TRACKS ====================
   */

  /**
   * Save related tracks
   */
  public async saveRelatedTracks(
    sourceTrackId: string, 
    relatedTracks: RelatedTrackInput[]
  ): Promise<boolean> {
    console.log(`\n🔗 Saving ${relatedTracks.length} related tracks for: ${sourceTrackId}`);
    
    if (!this.enabled || !this.supabase || !relatedTracks.length) return false;

    try {
      // First, save all related tracks
      for (const track of relatedTracks) {
        console.log(`   Processing related track: ${track.title} by ${track.artist}`);
        
        const trackId = await this.saveTrack({
          title: track.title,
          artist: track.artist,
          album: track.album,
          isrc: track.isrc
        });
        
        if (trackId) {
          // Create relationship
          await this.supabase
            .from('related_tracks')
            .upsert({
              source_track: sourceTrackId,
              related_track: trackId,
              relevance: track.relevance,
              reason: track.reason,
              created_at: new Date().toISOString()
            }, {
              onConflict: 'source_track,related_track'
            });
          
          console.log(`   ✅ Related track saved: ${trackId}`);
        }
      }

      console.log('✅ All related tracks saved');
      return true;
    } catch (error) {
      console.error('❌ Save related tracks error:', error);
      return false;
    }
  }

  /**
   * Get related tracks
   */
  public async getRelatedTracks(trackId: string, limit = 10): Promise<TrackMetadata[]> {
    console.log(`\n🔗 Getting related tracks for: ${trackId}`);
    
    if (!this.enabled || !this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('related_tracks')
        .select(`
          related_track,
          tracks!related_tracks_related_track_fkey (*)
        `)
        .eq('source_track', trackId)
        .order('relevance', { ascending: false })
        .limit(limit);

      if (error || !data) {
        console.error('❌ Get related tracks error:', error);
        return [];
      }

      console.log(`   Found ${data.length} related tracks`);

      return data.map(item => ({
        id: item.tracks.id,
        isrc: item.tracks.isrc,
        title: item.tracks.title,
        artist: item.tracks.artist,
        album: item.tracks.album,
        duration: item.tracks.duration,
        artworkUrl: item.tracks.artwork_url,
        spotifyId: item.tracks.spotify_id,
        youtubeId: item.tracks.youtube_id,
        deezerId: item.tracks.deezer_id,
        soundcloudId: item.tracks.soundcloud_id,
        metadata: item.tracks.metadata
      }));
    } catch (error) {
      console.error('❌ Get related tracks error:', error);
      return [];
    }
  }

  /**
   * ==================== ARTIST METHODS ====================
   */

  /**
   * Save artist cache
   */
  public async saveArtist(artistName: string, data: Partial<ArtistCache>): Promise<boolean> {
    console.log(`\n👤 Saving artist: ${artistName}`);
    
    if (!this.enabled || !this.supabase) return false;

    try {
      await this.supabase
        .from('artist_cache')
        .upsert({
          name: artistName.toLowerCase(),
          top_tracks: data.topTracks || [],
          albums: data.albums || [],
          similar: data.similar || [],
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'name'
        });

      console.log('✅ Artist saved');
      return true;
    } catch (error) {
      console.error('❌ Save artist error:', error);
      return false;
    }
  }

  /**
   * Get artist cache
   */
  public async getArtist(artistName: string): Promise<ArtistCache | null> {
    console.log(`\n👤 Getting artist: ${artistName}`);
    
    if (!this.enabled || !this.supabase) return null;

    try {
      const { data, error } = await this.supabase
        .from('artist_cache')
        .select('*')
        .eq('name', artistName.toLowerCase())
        .maybeSingle();

      if (error || !data) {
        console.log('   Artist not found in cache');
        return null;
      }

      console.log('✅ Artist found');

      return {
        id: data.id,
        name: data.name,
        topTracks: data.top_tracks,
        albums: data.albums,
        similar: data.similar,
        lastUpdated: data.last_updated
      };
    } catch (error) {
      console.error('❌ Get artist error:', error);
      return null;
    }
  }

  /**
   * ==================== POPULAR SEARCHES ====================
   */

  /**
   * Get popular searches for pre-caching
   */
  public async getPopularSearches(limit = 50, minHits = 10): Promise<Array<{ query: string; trackId: string; hitCount: number }>> {
    console.log(`\n📊 Getting popular searches (min hits: ${minHits}, limit: ${limit})`);
    
    if (!this.enabled || !this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from('searches')
        .select('query, track_id, hit_count')
        .gte('hit_count', minHits)
        .order('hit_count', { ascending: false })
        .limit(limit);

      if (error || !data) {
        console.error('❌ Get popular searches error:', error);
        return [];
      }

      console.log(`   Found ${data.length} popular searches`);

      return data.map(item => ({
        query: item.query,
        trackId: item.track_id,
        hitCount: item.hit_count
      }));
    } catch (error) {
      console.error('❌ Get popular searches error:', error);
      return [];
    }
  }

  /**
   * ==================== STREAM HEALTH ====================
   */

  /**
   * Get streams expiring soon
   */
  public async getExpiringStreams(hoursThreshold = 6): Promise<StreamData[]> {
    console.log(`\n⏰ Getting streams expiring in ${hoursThreshold} hours`);
    
    if (!this.enabled || !this.supabase) return [];

    try {
      const thresholdDate = new Date(
        Date.now() + (hoursThreshold * 60 * 60 * 1000)
      ).toISOString();

      const { data, error } = await this.supabase
        .from('streams')
        .select('*')
        .eq('is_active', true)
        .lt('expiry', thresholdDate)
        .limit(100);

      if (error || !data) {
        console.error('❌ Get expiring streams error:', error);
        return [];
      }

      console.log(`   Found ${data.length} expiring streams`);

      return data.map(item => ({
        id: item.id,
        trackId: item.track_id,
        source: item.source,
        streamUrl: item.stream_url,
        quality: item.quality,
        format: item.format,
        expiry: item.expiry,
        isActive: item.is_active,
        healthScore: item.health_score,
        failureCount: item.failure_count,
        lastVerified: item.last_verified
      }));
    } catch (error) {
      console.error('❌ Get expiring streams error:', error);
      return [];
    }
  }

  /**
   * Get stale tracks (not accessed in N days)
   */
  public async getStaleTracks(daysThreshold = 90): Promise<string[]> {
    console.log(`\n🧹 Getting stale tracks (not accessed in ${daysThreshold} days)`);
    
    if (!this.enabled || !this.supabase) return [];

    try {
      const thresholdDate = new Date(
        Date.now() - (daysThreshold * 24 * 60 * 60 * 1000)
      ).toISOString();

      const { data, error } = await this.supabase
        .from('tracks')
        .select('id')
        .lt('last_accessed', thresholdDate)
        .limit(1000);

      if (error || !data) {
        console.error('❌ Get stale tracks error:', error);
        return [];
      }

      console.log(`   Found ${data.length} stale tracks`);
      return data.map(t => t.id);
    } catch (error) {
      console.error('❌ Get stale tracks error:', error);
      return [];
    }
  }

  /**
   * ==================== STATS ====================
   */

  /**
   * Get cache statistics
   */
  public async getStats(): Promise<SupabaseStats | null> {
    console.log('\n📊 Getting cache statistics');
    
    if (!this.enabled || !this.supabase) return null;

    try {
      const [tracks, streams, searches] = await Promise.all([
        this.supabase.from('tracks').select('*', { count: 'exact', head: true }),
        this.supabase.from('streams').select('*', { count: 'exact', head: true }).eq('is_active', true),
        this.supabase.from('searches').select('*', { count: 'exact', head: true })
      ]);

      const stats = {
        tracks: tracks.count || 0,
        activeStreams: streams.count || 0,
        searches: searches.count || 0
      };

      console.log('📊 Stats:', stats);
      return stats;
    } catch (error) {
      console.error('❌ Get stats error:', error);
      return null;
    }
  }

  /**
   * Check if cache is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const supabaseCache = new SupabaseCache();