// supabase/functions/metadata-source/types.ts

export interface SearchParams {
    query: string;
    limit?: number;
}

export interface SpotifyTrackData {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album?: {
        name: string;
        release_date?: string;
        images?: Array<{ url: string }>;
    };
    duration_ms?: number;
    external_ids?: { isrc?: string };
    preview_url?: string;
    popularity?: number;
    explicit?: boolean;
}

export interface DeezerTrackData {
    id: number;
    title: string;
    artist: { name: string };
    album: {
        title: string;
        cover_big: string;
        cover_small: string;
        cover_medium: string;
        release_date?: string;
    };
    duration: number;
    isrc?: string;
    preview: string;
    rank: number;
    explicit_lyrics: boolean;
}

export interface SoundCloudTrackData {
    id: number;
    title: string;
    user: { 
        username: string; 
        full_name?: string;
        avatar_url?: string;
    };
    duration: number;
    isrc?: string | null;
    artwork_url?: string;
    stream_url?: string;
    playback_count?: number;
    likes_count?: number;
    access: 'playable' | 'preview' | 'blocked';
    genre?: string;
    release_date?: string;
    description?: string;
    tag_list?: string;
}

export interface UnifiedMetadata {
    source: 'spotify' | 'deezer' | 'soundcloud';
    title: string;
    artist: string;
    artistId?: string | number;
    album: string;
    albumId?: string | number;
    duration: number; // in seconds
    isrc: string | null;
    artworkUrl: string;
    artworkThumbnail: string;
    artworkMedium?: string;
    releaseDate: string | null;
    popularity: number;
    explicit: boolean;
    previewUrl: string | null;
    sourceId: string | number;
    genre?: string;
    label?: string;
    trackNumber?: number;
    discNumber?: number;
}

export interface FunctionResponse {
    success: boolean;
    source: 'spotify' | 'deezer' | 'soundcloud' | 'none';
    data?: {
        track: UnifiedMetadata;
    };
    error?: string;
    responseTime: number;
}

export type SettledResult<T> = PromiseSettledResult<T>;