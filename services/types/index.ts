// src/services/types/index.ts

export type Source = 
  | 'spotify'
  | 'deezer'
  | 'soundcloud'
  | 'youtube'
  | 'youtubeMusic'
  | 'vk'
  | 'yandex'
  | 'bandcamp'
  | 'amazon'
  | 'tidal'
  | 'qobuz'
  | 'napster'
  | 'pandora'
  | 'lastfm'
  | 'discogs'
  | 'genius'
  | 'musixmatch';

export interface Artist {
  id?: string | number;
  name: string;
  image?: string;
}

export interface TrackData {
  id?: string | number;
  title: string;
  artist: Artist;
  album?: string;
  image?: string;
  duration?: number;
  isrc?: string;
  source?: Source;
}

export interface AudioSource {
  name: Source;
  enabled: boolean;
  priority: number;
}

export interface PlayerStore {
  audioSources: AudioSource[];
  isWithAutomatch: boolean;
  variants: any[];
}

export interface SearchResponse {
  search: {
    tracks: any[];
  };
}

export interface PlayerSearchParams {
  source?: Source;
  trackData: TrackData;
  limit?: number;
  audioSourceIndex?: number;
}