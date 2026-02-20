// src/services/api/player/search/get.ts
import getTrack from '../../track/get';
import { TrackData, Source } from '../../../types/track';
import { CacheFortress } from '../../../cache/fortress';

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
  const cached = await CacheFortress.get<PlayerSearchResult>(cacheKey);
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

  if (source) {
    try {
      const track = await getTrack({
        source,
        artistName: artist,
        trackTitle: title,
        trackId: id,
        limit,
      });

      if (track) {
        const result = { tracks: [track], source };
        await CacheFortress.set(cacheKey, result);
        console.log(`✅ Player search found on ${source} (${Date.now() - startTime}ms)`);
        return result;
      }
    } catch (error) {
      console.log(`❌ ${source} failed:`, error);
    }
    return null;
  }

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
        await CacheFortress.set(cacheKey, result);
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