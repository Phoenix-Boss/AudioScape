// supabase/functions/unified-metadata/types.ts

export interface SearchParams {
    query: string;
    limit?: number;
}

export interface SpotifyTrack {
    id: string;
    name: string;
    artists: Array<{ name: string }>;
    album: {
        name: string;
        releaseDate: string;
        images: Array<{ url: string }>;
    };
    duration: number;
    isrc?: string;
    externalIds?: { isrc?: string };
    previewUrl?: string;
    popularity?: number;
    explicit?: boolean;
}

export interface DeezerTrack {
    id: number;
    title: string;
    artist: { name: string };
    album: {
        title: string;
        cover_big: string;
        cover_small: string;
        release_date?: string;
    };
    duration: number;
    isrc?: string;
    preview: string;
    rank: number;
    explicit_lyrics: boolean;
}

export interface SoundCloudTrack {
    id: number;
    title: string;
    user: { username: string };
    duration: number;
    isrc?: string | null;
    artwork_url?: string;
    stream_url?: string;
    playback_count?: number;
    access: 'playable' | 'preview';
}

export interface UnifiedMetadata {
    source: 'spotify' | 'deezer' | 'soundcloud';
    title: string;
    artist: string;
    album: string;
    duration: number; // in seconds
    isrc: string | null;
    artworkUrl: string;
    artworkThumbnail: string;
    releaseDate: string | null;
    popularity: number;
    explicit: boolean;
    previewUrl?: string | null;
    sourceId: string | number;
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