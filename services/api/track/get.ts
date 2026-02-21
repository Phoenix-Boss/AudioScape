// src/services/api/track/get.ts
import formatTrackRequestUrl from '../../formatters/request/track/url';
import getRequest from '../request/get';
import { cache } from '../../../libs/cache';
import { TrackData, Source, Artist } from '../../types';

export interface GetTrackParams {
  source?: Source;
  artistName?: string;
  trackTitle?: string;
  artistId?: string | number;
  albumId?: string | number;
  trackId?: string | number;
  scope?: string;
  page?: number;
  limit?: number;
}

interface GetTrackOptions {
  isSetPlayerPlaying?: boolean;
}

export default async function getTrack({
  source = 'lastfm',
  artistName,
  trackTitle,
  artistId,
  albumId,
  trackId,
  scope = '',
  page,
  limit,
  isSetPlayerPlaying = true,
}: GetTrackParams & GetTrackOptions): Promise<TrackData | null> {
  const startTime = Date.now();

  // Validate required parameters
  if (!artistName && !trackTitle && !trackId) {
    console.error('❌ Either artistName/trackTitle or trackId is required');
    return null;
  }

  const url = formatTrackRequestUrl({
    source,
    artistName,
    trackTitle,
    artistId,
    albumId,
    trackId,
    scope,
  });

  // Validate URL
  if (!url) {
    console.error(`❌ Invalid URL generated for source: ${source}`);
    return null;
  }

  const scopes = {
    id: ['', 'similar', 'profiles'],
    language: ['', 'description'],
  };

  const isMatchedScope = (selfScope: string) => selfScope === scope.toString();
  const isWithSelfId = scopes.id.some(isMatchedScope);
  const isWithSelfLanguage = scopes.language.some(isMatchedScope);

  const cacheKey = `track:${source}:${trackId || `${artistName}-${trackTitle}`}`;

  // Try cache first
  const cached = await cache.device.get<TrackData>(cacheKey);
  if (cached) {
    console.log(`📦 Cache HIT: ${cacheKey}`);
    return cached;
  }

  try {
    const response = await getRequest({
      url,
      params: {
        ...(source === 'spotify' && { type: 'track', q: `${artistName} ${trackTitle}` }),
        ...(source === 'deezer' && { q: `${artistName} ${trackTitle}` }),
        ...(source === 'soundcloud' && { q: `${artistName} ${trackTitle}` }),
        ...(source === 'lastfm' && { 
          method: 'track.getInfo',
          api_key: process.env.LASTFM_API_KEY,
          format: 'json',
          artist: artistName,
          track: trackTitle 
        }),
      },
      isWithSelfToken: source !== 'deezer' && source !== 'lastfm',
      isWithSelfId,
      isWithSelfLanguage,
      page,
      limit,
    });

    // Validate response
    if (!response || !response.data) {
      console.log(`❌ Empty response from ${source}`);
      return null;
    }

    // Handle different response formats based on source
    let trackData: any = null;
    
    switch (source) {
      case 'spotify':
        if (response.data?.tracks?.items?.length > 0) {
          trackData = response.data.tracks.items[0];
        }
        break;
        
      case 'deezer':
        if (response.data?.data?.length > 0) {
          trackData = response.data.data[0];
        }
        break;
        
      case 'soundcloud':
        if (response.data?.collection?.length > 0) {
          trackData = response.data.collection[0];
        }
        break;
        
      case 'youtubeMusic':
        try {
          const sections = response.data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents;
          if (Array.isArray(sections)) {
            for (const section of sections) {
              const contents = section?.musicShelfRenderer?.contents;
              if (Array.isArray(contents) && contents.length > 0) {
                trackData = contents[0]?.musicResponsiveListItemRenderer;
                if (trackData) break;
              }
            }
          }
        } catch (e) {
          console.log('YouTube Music parsing error:', e);
        }
        break;
        
      case 'tidal':
        if (response.data?.data?.length > 0) {
          trackData = response.data.data[0];
        }
        break;
        
      case 'vk':
        if (response.data?.response?.items?.length > 0) {
          trackData = response.data.response.items[0];
        }
        break;
        
      case 'yandex':
        if (response.data?.result?.tracks?.length > 0) {
          trackData = response.data.result.tracks[0];
        }
        break;
        
      case 'bandcamp':
        if (response.data?.results?.length > 0) {
          trackData = response.data.results.find((item: any) => item?.type === 'track');
        }
        break;
        
      case 'lastfm':
        if (response.data?.track) {
          trackData = response.data.track;
        }
        break;
    }

    // If no track found, return null
    if (!trackData) {
      console.log(`ℹ️ No track found for ${source}: ${artistName} - ${trackTitle}`);
      return null;
    }

    // Construct artist object based on source
    let artist: Artist = { name: 'Unknown Artist' };
    
    switch (source) {
      case 'spotify':
        artist = {
          id: trackData.artists?.[0]?.id,
          name: trackData.artists?.[0]?.name || 'Unknown Artist',
          image: trackData.artists?.[0]?.images?.[0]?.url
        };
        break;
        
      case 'deezer':
        artist = {
          id: trackData.artist?.id,
          name: trackData.artist?.name || 'Unknown Artist',
          image: trackData.artist?.picture_medium
        };
        break;
        
      case 'soundcloud':
        artist = {
          id: trackData.user?.id,
          name: trackData.user?.username || 'Unknown Artist',
          image: trackData.user?.avatar_url
        };
        break;
        
      case 'youtubeMusic':
        artist = {
          name: trackData?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Unknown Artist'
        };
        break;
        
      case 'tidal':
        artist = {
          id: trackData.artist?.id,
          name: trackData.artist?.name || 'Unknown Artist'
        };
        break;
        
      case 'vk':
        artist = {
          name: trackData.artist || 'Unknown Artist'
        };
        break;
        
      case 'yandex':
        artist = {
          id: trackData.artists?.[0]?.id,
          name: trackData.artists?.[0]?.name || 'Unknown Artist'
        };
        break;
        
      case 'bandcamp':
        artist = {
          name: trackData.band?.name || 'Unknown Artist'
        };
        break;
        
      case 'lastfm':
        artist = {
          name: trackData.artist?.name || 'Unknown Artist',
          image: trackData.artist?.image?.[0]?.['#text']
        };
        break;
    }

    // Construct normalized track data
    const normalizedData: TrackData = {
      id: trackData.id || trackId || `unknown-${Date.now()}`,
      title: trackData.title || trackData.name || trackTitle || 'Unknown Title',
      artist,
      album: trackData.album?.title || 
             trackData.album?.name || 
             trackData.album,
      image: trackData.album?.images?.[0]?.url || 
             trackData.artwork_url?.replace('large', 't500x500') ||
             trackData.thumbnail ||
             artist.image,
      duration: trackData.duration_ms
        ? Math.floor(trackData.duration_ms / 1000)
        : trackData.duration
        ? Math.floor(trackData.duration / 1000)
        : trackData.duration,
      isrc: trackData.isrc || trackData.external_ids?.isrc,
      source: source as Source,
    };

    // Save to cache
    await cache.device.set(cacheKey, normalizedData, 24 * 60 * 60 * 1000); // 24 hours TTL
    
    // Also try to save to Supabase cache (non-blocking)
    try {
      await cache.supabase.set(cacheKey, normalizedData);
    } catch {
      // Silently fail - Supabase cache is optional
    }

    console.log(`🎵 Track fetched from ${source} (${Date.now() - startTime}ms)`);
    return normalizedData;

  } catch (error: any) {
    console.error(`❌ Failed to fetch track from ${source}:`, error?.message || 'Unknown error');
    return null;
  }
}