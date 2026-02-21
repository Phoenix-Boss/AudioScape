// src/services/api/player/search/get.ts
import { cache } from '../../../../libs/cache';
import getTrack from '../../track/get';
import { TrackData, Source, Artist } from '../../../types';

export interface PlayerSearchParams {
  trackData: {
    artist?: string;
    title?: string;
    id?: string | number;
  };
  source?: Source;
  audioSourceIndex?: number;
  limit?: number;
}

export interface PlayerSearchResult {
  tracks: TrackData[];
  source: Source;
}

export default async function getPlayerSearch({
  trackData,
  source,
  audioSourceIndex = 0,
  limit = 10,
}: PlayerSearchParams): Promise<PlayerSearchResult | null> {
  const startTime = Date.now();
  
  const { artist, title, id } = trackData;
  
  if (!artist || !title) {
    console.warn('Missing artist or title in trackData');
    return null;
  }

  const cacheKey = `player-search:${artist}:${title}`;

  // Try cache first using your actual cache
  const cached = await cache.device.get<PlayerSearchResult>(cacheKey);
  if (cached) {
    console.log(`📦 Player search cache hit: ${artist} - ${title}`);
    return cached;
  }

  const audioSources: Source[] = [
    'spotify',
    'deezer',
    'soundcloud',
    'youtubeMusic',
    'tidal',
    'qobuz',
    'amazon',
    'napster',
    'pandora',
    'vk',
    'yandex',
    'bandcamp'
  ];

  // If a specific source is requested, try only that one
  if (source) {
    try {
      console.log(`🔍 Trying requested source ${source} for "${artist} - ${title}"...`);
      
      const track = await getTrack({
        source,
        artistName: artist,
        trackTitle: title,
        trackId: id,
        limit,
      });

      if (track) {
        const result = { tracks: [track], source };
        
        // Save to cache
        await cache.device.set(cacheKey, result, 7 * 24 * 60 * 60 * 1000); // 7 days TTL
        
        // Also try to save to Supabase cache (non-blocking)
        try {
          await cache.supabase.set(cacheKey, result);
        } catch {
          // Silently fail - Supabase cache is optional
        }
        
        console.log(`✅ Player search found on ${source} (${Date.now() - startTime}ms)`);
        return result;
      }
    } catch (error) {
      console.log(`❌ ${source} failed:`, error);
    }
    return null;
  }

  // Try sources in order with fallback
  for (let i = audioSourceIndex; i < audioSources.length; i++) {
    const currentSource = audioSources[i];
    
    try {
      console.log(`🔍 Trying ${currentSource} for "${artist} - ${title}"...`);
      
      const track = await getTrack({
        source: currentSource,
        artistName: artist,
        trackTitle: title,
        trackId: id,
        limit,
      });

      if (track) {
        const result = { tracks: [track], source: currentSource };
        
        // Save to cache
        await cache.device.set(cacheKey, result, 7 * 24 * 60 * 60 * 1000); // 7 days TTL
        
        // Also try to save to Supabase cache (non-blocking)
        try {
          await cache.supabase.set(cacheKey, result);
        } catch {
          // Silently fail
        }
        
        console.log(`✅ Found on ${currentSource} (${Date.now() - startTime}ms)`);
        return result;
      }
    } catch (error) {
      console.log(`❌ ${currentSource} failed, trying next...`);
      continue;
    }
  }

  console.log(`❌ No results found for "${artist} - ${title}" after trying ${audioSources.length} sources`);
  return null;
}