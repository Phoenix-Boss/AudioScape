// src/services/api/track/get.ts
import formatTrackRequestUrl from '../../formatters/request/track/url';
import getRequest from '../request/get';
import { CacheFortress } from '../../cache/fortress';
import { GetTrackParams, TrackData, TrackResponse } from '../../types/track';

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
}: GetTrackParams & GetTrackOptions): Promise<TrackData | undefined> {
  const startTime = Date.now();

  const url = formatTrackRequestUrl({
    source,
    artistName,
    trackTitle,
    artistId,
    albumId,
    trackId,
    scope,
  });

  const scopes = {
    id: ['', 'similar', 'profiles'],
    language: ['', 'description'],
  };

  const isMatchedScope = (selfScope: string) => selfScope === scope.toString();
  const isWithSelfId = scopes.id.some(isMatchedScope);
  const isWithSelfLanguage = scopes.language.some(isMatchedScope);

  const cacheKey = `track:${source}:${trackId || `${artistName}-${trackTitle}`}`;

  const cached = await CacheFortress.get<TrackData>(cacheKey);
  if (cached) {
    console.log(`📦 Cache Hit: ${cacheKey}`);
    return cached;
  }

  const handleSuccess = async (response: any) => {
    const trackData = response.data.track || response.data;

    const normalizedData: TrackData = {
      id: trackData.id || trackId,
      title: trackData.title || trackData.name || trackTitle,
      artist: trackData.artist?.name || trackData.artist || artistName,
      artistId: trackData.artist?.id || artistId,
      album: trackData.album?.title || trackData.album?.name || trackData.album,
      albumId: trackData.album?.id || albumId,
      image: trackData.album?.images?.[0]?.url || trackData.artwork_url,
      duration: trackData.duration_ms
        ? Math.floor(trackData.duration_ms / 1000)
        : trackData.duration,
      source,
      audio: {
        present: !!trackData.preview_url || !!trackData.audio?.link,
        link: trackData.preview_url || trackData.audio?.link,
      },
    };

    await CacheFortress.set(cacheKey, normalizedData);

    console.log(`🎵 Track fetched from ${source} (${Date.now() - startTime}ms)`);

    return normalizedData;
  };

  const handleError = async (error: any) => {
    console.error(`❌ Failed to fetch track from ${source}:`, error.message);
    throw error;
  };

  return getRequest({
    url,
    params: {
      ...(source === 'spotify' && { type: 'track', q: `${artistName} ${trackTitle}` }),
      ...(source === 'deezer' && { q: `${artistName} ${trackTitle}` }),
      ...(source === 'soundcloud' && { q: `${artistName} ${trackTitle}` }),
    },
    isWithSelfToken: source !== 'deezer',
    isWithSelfId,
    isWithSelfLanguage,
    page,
    limit,
    onSuccess: handleSuccess,
    onError: handleError,
  });
}