// src/services/formatters/request/track/url.ts
import { Source } from '../../../types/track';

interface UrlParams {
  source: Source;
  artistName?: string;
  trackTitle?: string;
  artistId?: string | number;
  albumId?: string | number;
  trackId?: string | number;
  scope?: string;
}

export default function formatTrackRequestUrl({
  source,
  artistName,
  trackTitle,
  artistId,
  albumId,
  trackId,
  scope = '',
}: UrlParams): string {
  const artistNameEncoded = artistName ? encodeURIComponent(artistName) : '';
  const trackTitleEncoded = trackTitle ? encodeURIComponent(trackTitle) : '';

  switch (source) {
    case 'spotify':
      if (trackId) {
        return `https://api.spotify.com/v1/tracks/${trackId}`;
      }
      return `https://api.spotify.com/v1/search`;

    case 'deezer':
      if (trackId) {
        return `https://api.deezer.com/track/${trackId}`;
      }
      return `https://api.deezer.com/search`;

    case 'soundcloud':
      if (trackId) {
        return `https://api-v2.soundcloud.com/tracks/${trackId}`;
      }
      return `https://api-v2.soundcloud.com/search/tracks`;

    case 'youtube':
      return `https://www.googleapis.com/youtube/v3/search`;

    case 'youtubeMusic':
      return `https://music.youtube.com/youtubei/v1/player`;

    case 'vk':
      return `https://api.vk.com/method/audio.getById`;

    case 'yandex':
      if (trackId) {
        return `https://api.music.yandex.net/tracks/${trackId}`;
      }
      return `https://api.music.yandex.net/search`;

    case 'lastfm':
      return `https://ws.audioscrobbler.com/2.0/?method=track.getInfo&artist=${artistNameEncoded}&track=${trackTitleEncoded}`;

    case 'bandcamp':
      if (artistId && trackId) {
        return `https://bandcamp.com/api/mobile/22/tracks/${trackId}?artist_id=${artistId}`;
      }
      return `https://bandcamp.com/api/mobile/22/search`;

    case 'amazon':
      if (trackId && albumId) {
        return `https://api.amazon.com/music/tracks/${trackId}?album_id=${albumId}`;
      }
      return `https://api.amazon.com/music/search`;

    case 'tidal':
      if (trackId) {
        return `https://api.tidal.com/v1/tracks/${trackId}`;
      }
      return `https://api.tidal.com/v1/search`;

    case 'qobuz':
      if (trackId) {
        return `https://www.qobuz.com/api.json/0.2/track/get?track_id=${trackId}`;
      }
      return `https://www.qobuz.com/api.json/0.2/track/search`;

    default:
      return `https://api.${source}.com/tracks/${trackId}`;
  }
}