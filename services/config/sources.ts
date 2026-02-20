// src/services/config/sources.ts
import { Source } from '../types/track';

export const SOURCE_PRIORITY: Record<Source, number> = {
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
  musixmatch: 17,
};

export const SOURCE_CONFIG: Record<
  Source,
  {
    requiresToken: boolean;
    baseUrl: string;
    color: string;
    enabled: boolean;
    timeout: number;
  }
> = {
  spotify: {
    requiresToken: true,
    baseUrl: 'https://api.spotify.com/v1',
    color: '#1DB954',
    enabled: true,
    timeout: 5000,
  },
  deezer: {
    requiresToken: false,
    baseUrl: 'https://api.deezer.com',
    color: '#A238FF',
    enabled: true,
    timeout: 3000,
  },
  soundcloud: {
    requiresToken: false, // Uses client_id
    baseUrl: 'https://api-v2.soundcloud.com',
    color: '#FF5500',
    enabled: true,
    timeout: 5000,
  },
  youtube: {
    requiresToken: false,
    baseUrl: 'https://www.googleapis.com/youtube/v3',
    color: '#FF0000',
    enabled: true,
    timeout: 5000,
  },
  youtubeMusic: {
    requiresToken: false,
    baseUrl: 'https://music.youtube.com/youtubei/v1',
    color: '#FF0000',
    enabled: true,
    timeout: 5000,
  },
  vk: {
    requiresToken: true,
    baseUrl: 'https://api.vk.com/method',
    color: '#4C75A3',
    enabled: true,
    timeout: 5000,
  },
  yandex: {
    requiresToken: true,
    baseUrl: 'https://api.music.yandex.net',
    color: '#FFCC00',
    enabled: true,
    timeout: 5000,
  },
  bandcamp: {
    requiresToken: false,
    baseUrl: 'https://bandcamp.com/api',
    color: '#629AA9',
    enabled: true,
    timeout: 5000,
  },
  amazon: {
    requiresToken: true,
    baseUrl: 'https://api.amazon.com/music',
    color: '#FF9900',
    enabled: true,
    timeout: 5000,
  },
  tidal: {
    requiresToken: true,
    baseUrl: 'https://api.tidal.com/v1',
    color: '#000000',
    enabled: true,
    timeout: 5000,
  },
  qobuz: {
    requiresToken: true,
    baseUrl: 'https://www.qobuz.com/api.json/0.2',
    color: '#00AFFF',
    enabled: true,
    timeout: 5000,
  },
  napster: {
    requiresToken: true,
    baseUrl: 'https://api.napster.com/v2.2',
    color: '#00A3E0',
    enabled: true,
    timeout: 5000,
  },
  pandora: {
    requiresToken: true,
    baseUrl: 'https://api.pandora.com',
    color: '#224099',
    enabled: true,
    timeout: 5000,
  },
  lastfm: {
    requiresToken: true,
    baseUrl: 'https://ws.audioscrobbler.com/2.0',
    color: '#D51007',
    enabled: true,
    timeout: 5000,
  },
  discogs: {
    requiresToken: true,
    baseUrl: 'https://api.discogs.com',
    color: '#333333',
    enabled: true,
    timeout: 5000,
  },
  genius: {
    requiresToken: true,
    baseUrl: 'https://api.genius.com',
    color: '#FFFF66',
    enabled: false,
    timeout: 5000,
  },
  musixmatch: {
    requiresToken: true,
    baseUrl: 'https://api.musixmatch.com/ws/1.1',
    color: '#FF6600',
    enabled: false,
    timeout: 5000,
  },
};

export const DEFAULT_SOURCES: Source[] = ['spotify', 'deezer', 'soundcloud'];
export const DEFAULT_LIMIT = 10;
export const DEFAULT_TIMEOUT = 5000;