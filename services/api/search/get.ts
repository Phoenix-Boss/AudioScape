// src/services/api/search/get.ts
import { Source, TrackData } from '../../types/track';
import getRequest from '../request/get';
import { CacheFortress } from '../../cache/fortress';
import getTrack from '../track/get';

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

  const cached = await CacheFortress.get<SearchResult>(cacheKey);
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
        }

        const response = await getRequest({
          url,
          params,
          isWithSelfToken: src !== 'deezer' && src !== 'bandcamp',
        });

        const tracks = extractTracksFromResponse(src, response, query);
        result.tracks.push(...tracks);
        
      } catch (error) {
        console.log(`❌ ${src} search failed:`, error);
      }
    })
  );

  result.tracks = result.tracks.slice(0, limit);
  
  await CacheFortress.set(cacheKey, result, 60 * 60 * 1000); // 1 hour cache
  console.log(`🔍 Search completed in ${Date.now() - startTime}ms: ${result.tracks.length} tracks`);

  return result;
}

function extractTracksFromResponse(source: Source, response: any, query: string): TrackData[] {
  const data = response.data;
  const tracks: TrackData[] = [];

  switch (source) {
    case 'spotify':
      if (data.tracks?.items) {
        data.tracks.items.forEach((item: any) => {
          tracks.push({
            id: item.id,
            title: item.name,
            artist: item.artists[0]?.name || 'Unknown',
            artistId: item.artists[0]?.id,
            album: item.album.name,
            albumId: item.album.id,
            duration: Math.floor(item.duration_ms / 1000),
            image: item.album.images[0]?.url,
            source,
          });
        });
      }
      break;

    case 'deezer':
      if (data.data) {
        data.data.forEach((item: any) => {
          tracks.push({
            id: item.id,
            title: item.title,
            artist: item.artist.name,
            artistId: item.artist.id,
            album: item.album.title,
            albumId: item.album.id,
            duration: item.duration,
            image: item.album.cover_medium,
            source,
          });
        });
      }
      break;

    case 'soundcloud':
      if (data.collection) {
        data.collection.forEach((item: any) => {
          tracks.push({
            id: item.id,
            title: item.title,
            artist: item.user.username,
            artistId: item.user.id,
            album: 'SoundCloud Track',
            duration: Math.floor(item.duration / 1000),
            image: item.artwork_url?.replace('large', 't500x500'),
            source,
          });
        });
      }
      break;
  }

  return tracks;
}