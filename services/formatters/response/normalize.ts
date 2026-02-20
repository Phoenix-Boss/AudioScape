// src/services/formatters/response/normalize.ts
import { TrackData, Source } from '../../types/track';

export function normalizeTrackResponse(
  response: any,
  source: Source,
  limit: number = 10
): TrackData[] {
  const result: TrackData[] = [];

  try {
    switch (source) {
      case 'spotify': {
        const items = response.data?.tracks?.items || response.data?.items || [];
        result.push(
          ...items.slice(0, limit).map((track: any) => ({
            id: track.id,
            title: track.name,
            artist: track.artists?.[0]?.name || 'Unknown Artist',
            artistId: track.artists?.[0]?.id,
            album: track.album?.name,
            albumId: track.album?.id,
            image: track.album?.images?.[0]?.url,
            duration: Math.floor(track.duration_ms / 1000),
            source,
            audio: {
              present: !!track.preview_url,
              link: track.preview_url,
            },
          }))
        );
        break;
      }

      case 'deezer': {
        const items = response.data?.data || [];
        result.push(
          ...items.slice(0, limit).map((track: any) => ({
            id: track.id,
            title: track.title,
            artist: track.artist?.name || 'Unknown Artist',
            artistId: track.artist?.id,
            album: track.album?.title,
            albumId: track.album?.id,
            image: track.album?.cover_big || track.album?.cover_small,
            duration: track.duration,
            source,
            audio: {
              present: !!track.preview,
              link: track.preview,
            },
          }))
        );
        break;
      }

      case 'soundcloud': {
        const items = response.data?.collection || response.data || [];
        result.push(
          ...items.slice(0, limit).map((track: any) => ({
            id: track.id,
            title: track.title,
            artist: track.user?.username || 'Unknown Artist',
            artistId: track.user?.id,
            album: 'SoundCloud Track',
            image: track.artwork_url?.replace('large', 't500x500'),
            duration: Math.floor(track.duration / 1000),
            source,
            audio: {
              present: !!track.stream_url,
              link: track.stream_url,
            },
          }))
        );
        break;
      }

      default:
        // Generic fallback
        if (response.data?.tracks) {
          const items = Array.isArray(response.data.tracks)
            ? response.data.tracks
            : [response.data.tracks];
          result.push(
            ...items.slice(0, limit).map((track: any) => ({
              id: track.id,
              title: track.title || track.name,
              artist: track.artist,
              album: track.album,
              image: track.image,
              duration: track.duration,
              source,
            }))
          );
        }
    }
  } catch (error) {
    console.error(`Normalization failed for ${source}:`, error);
  }

  return result;
}