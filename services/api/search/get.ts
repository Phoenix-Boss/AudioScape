// src/services/api/search/get.ts
import { cache } from '../../../libs/cache';
import { Source, TrackData, Artist } from '../../types';
import getRequest from '../request/get';

export interface SearchParams {
  query: string;
  source?: Source | 'all';
  type?: 'track' | 'album' | 'artist' | 'playlist' | 'all';
  limit?: number;
  page?: number;
}

export interface SearchResult {
  tracks: TrackData[];
  albums: any[];
  artists: any[];
  playlists: any[];
  total?: number;
  source: Source;
}

export default async function searchGet({
  query,
  source = 'all',
  type = 'track',
  limit = 10,
  page = 1,
}: SearchParams): Promise<SearchResult> {
  const startTime = Date.now();
  const cacheKey = `search:${source}:${type}:${query}:${page}`;

  // Try cache first using your actual cache
  const cached = await cache.device.get<SearchResult>(cacheKey);
  if (cached) {
    console.log(`📦 Search cache hit: "${query}"`);
    return cached;
  }

  const sources: Source[] = source === 'all' 
    ? ['spotify', 'deezer', 'soundcloud', 'youtubeMusic', 'tidal', 'qobuz', 'vk', 'yandex', 'bandcamp']
    : [source as Source];

  const result: SearchResult = {
    tracks: [],
    albums: [],
    artists: [],
    playlists: [],
    source: sources[0],
  };

  await Promise.allSettled(
    sources.map(async (src) => {
      try {
        let url = '';
        let params: any = {};

        switch (src) {
          case 'spotify':
            url = 'https://api.spotify.com/v1/search';
            params = { q: query, type: 'track,album,artist,playlist', limit };
            break;
          case 'deezer':
            url = 'https://api.deezer.com/search';
            params = { q: query, limit };
            break;
          case 'soundcloud':
            url = 'https://api-v2.soundcloud.com/search/tracks';
            params = { q: query, limit };
            break;
          case 'youtubeMusic':
            url = 'https://music.youtube.com/youtubei/v1/search?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
            params = {
              context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20250218.00.00' } },
              query,
            };
            break;
          case 'tidal':
            url = 'https://api.tidal.com/v1/search/tracks';
            params = { query, limit };
            break;
          case 'vk':
            url = 'https://api.vk.com/method/audio.search';
            params = { q: query, count: limit, v: '5.131' };
            break;
          case 'yandex':
            url = 'https://api.music.yandex.net/search';
            params = { text: query, type: 'track', page };
            break;
          case 'bandcamp':
            url = 'https://bandcamp.com/api/mobile/22/search';
            params = { q: query };
            break;
          default:
            console.log(`⚠️ Unsupported source: ${src}`);
            return;
        }

        // Skip if URL is empty
        if (!url) {
          console.log(`⚠️ No URL configured for ${src}`);
          return;
        }

        const response = await getRequest({
          url,
          params,
          isWithSelfToken: src !== 'deezer' && src !== 'bandcamp',
        });

        // Validate response
        if (!response || !response.data) {
          console.log(`⚠️ Empty response from ${src}`);
          return;
        }

        const tracks = extractTracksFromResponse(src, response);
        
        if (tracks.length > 0) {
          console.log(`✅ ${src} returned ${tracks.length} tracks`);
          result.tracks.push(...tracks);
        } else {
          console.log(`ℹ️ No tracks from ${src}`);
        }
        
      } catch (error: any) {
        console.log(`❌ ${src} search failed:`, error?.message || 'Unknown error');
      }
    })
  );

  // Sort tracks by source priority
  result.tracks = result.tracks
    .sort((a, b) => {
      const priority: Record<Source, number> = {
        spotify: 1,
        deezer: 2,
        youtubeMusic: 3,
        youtube: 4,
        soundcloud: 5,
        tidal: 6,
        qobuz: 7,
        amazon: 8,
        napster: 9,
        pandora: 10,
        vk: 11,
        yandex: 12,
        bandcamp: 13,
        lastfm: 14,
        discogs: 15,
        genius: 16,
        musixmatch: 17
      };
      return (priority[a.source as Source] || 99) - (priority[b.source as Source] || 99);
    })
    .slice(0, limit);

  // Save to cache
  if (result.tracks.length > 0) {
    await cache.device.set(cacheKey, result, 60 * 60 * 1000); // 1 hour TTL
    
    // Also try to save to Supabase cache (non-blocking)
    try {
      await cache.supabase.set(cacheKey, result);
    } catch {
      // Silently fail - Supabase cache is optional
    }
  }

  console.log(`🔍 Search completed in ${Date.now() - startTime}ms: ${result.tracks.length} tracks from ${[...new Set(result.tracks.map(t => t.source))].join(', ')}`);

  return result;
}

function extractTracksFromResponse(source: Source, response: any): TrackData[] {
  const tracks: TrackData[] = [];
  
  // Safely access data with optional chaining
  const data = response?.data;
  if (!data) return tracks;

  try {
    switch (source) {
      case 'spotify': {
        const items = data?.tracks?.items;
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (!item) return;
            
            const artist: Artist = {
              id: item.artists?.[0]?.id,
              name: item.artists?.[0]?.name || 'Unknown Artist',
              image: item.artists?.[0]?.images?.[0]?.url
            };

            tracks.push({
              id: item.id,
              title: item.name || 'Unknown Title',
              artist,
              album: item.album?.name,
              image: item.album?.images?.[0]?.url,
              duration: item.duration_ms ? Math.floor(item.duration_ms / 1000) : undefined,
              source,
            });
          });
        }
        break;
      }

      case 'deezer': {
        const items = data?.data;
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (!item) return;
            
            const artist: Artist = {
              id: item.artist?.id,
              name: item.artist?.name || 'Unknown Artist',
              image: item.artist?.picture_medium
            };

            tracks.push({
              id: item.id,
              title: item.title || 'Unknown Title',
              artist,
              album: item.album?.title,
              image: item.album?.cover_medium,
              duration: item.duration,
              source,
            });
          });
        }
        break;
      }

      case 'soundcloud': {
        const items = data?.collection;
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (!item) return;
            
            const artist: Artist = {
              id: item.user?.id,
              name: item.user?.username || 'Unknown Artist',
              image: item.user?.avatar_url
            };

            tracks.push({
              id: item.id,
              title: item.title || 'Unknown Title',
              artist,
              album: 'SoundCloud Track',
              image: item.artwork_url?.replace('large', 't500x500'),
              duration: item.duration ? Math.floor(item.duration / 1000) : undefined,
              source,
            });
          });
        }
        break;
      }

      case 'youtubeMusic': {
        try {
          const sections = data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
          if (Array.isArray(sections)) {
            sections.forEach((section: any) => {
              const contents = section?.musicShelfRenderer?.contents;
              if (Array.isArray(contents)) {
                contents.forEach((item: any) => {
                  const renderer = item?.musicResponsiveListItemRenderer;
                  if (!renderer) return;
                  
                  const artist: Artist = {
                    name: renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown'
                  };

                  tracks.push({
                    id: renderer?.playlistItemData?.videoId || renderer?.videoId,
                    title: renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown Title',
                    artist,
                    album: 'YouTube Music',
                    image: renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url,
                    duration: parseInt(renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[2]?.text) || 0,
                    source,
                  });
                });
              }
            });
          }
        } catch (e) {
          console.log('YouTube Music parsing error:', e);
        }
        break;
      }

      case 'tidal': {
        const items = data?.data;
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (!item) return;
            
            const artist: Artist = {
              id: item.artist?.id,
              name: item.artist?.name || 'Unknown',
            };

            tracks.push({
              id: item.id,
              title: item.title || 'Unknown Title',
              artist,
              album: item.album?.title,
              duration: item.duration,
              image: item.album?.cover,
              source,
            });
          });
        }
        break;
      }

      case 'vk': {
        const items = data?.response?.items;
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (!item) return;
            
            const artist: Artist = {
              name: item.artist || 'Unknown',
            };

            tracks.push({
              id: item.id,
              title: item.title || 'Unknown Title',
              artist,
              duration: item.duration,
              source,
            });
          });
        }
        break;
      }

      case 'yandex': {
        const items = data?.result?.tracks;
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (!item) return;
            
            const artist: Artist = {
              id: item.artists?.[0]?.id,
              name: item.artists?.[0]?.name || 'Unknown',
            };

            tracks.push({
              id: item.id,
              title: item.title || 'Unknown Title',
              artist,
              album: item.albums?.[0]?.title,
              duration: item.durationMs ? Math.floor(item.durationMs / 1000) : item.duration,
              source,
            });
          });
        }
        break;
      }

      case 'bandcamp': {
        const items = data?.results;
        if (Array.isArray(items)) {
          items.forEach((item: any) => {
            if (!item || item.type !== 'track') return;
            
            const artist: Artist = {
              name: item.band?.name || 'Unknown',
            };

            tracks.push({
              id: item.id,
              title: item.title || 'Unknown Title',
              artist,
              album: item.album?.title,
              duration: item.duration,
              image: item.art?.url,
              source,
            });
          });
        }
        break;
      }
    }
  } catch (error) {
    console.log(`Error extracting tracks from ${source}:`, error);
  }

  return tracks;
}