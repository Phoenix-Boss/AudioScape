// supabase/functions/unified-metadata/transformer.ts

import { UnifiedMetadata } from './types.ts';

export class MetadataTransformer {
    
    static fromSpotify(spotifyData: any): UnifiedMetadata {
        return {
            source: 'spotify',
            title: spotifyData.name,
            artist: spotifyData.artists?.[0]?.name || 'Unknown Artist',
            album: spotifyData.album?.name || 'Unknown Album',
            duration: spotifyData.duration, // Already in seconds
            isrc: spotifyData.isrc || null,
            artworkUrl: spotifyData.album?.images?.[0]?.url || '',
            artworkThumbnail: spotifyData.album?.images?.[2]?.url || spotifyData.album?.images?.[0]?.url || '',
            releaseDate: spotifyData.album?.releaseDate || null,
            popularity: spotifyData.popularity || 50,
            explicit: spotifyData.explicit || false,
            previewUrl: spotifyData.previewUrl,
            sourceId: spotifyData.id,
        };
    }

    static fromDeezer(deezerData: any): UnifiedMetadata {
        return {
            source: 'deezer',
            title: deezerData.title,
            artist: deezerData.artist.name,
            album: deezerData.album.title,
            duration: deezerData.duration,
            isrc: deezerData.isrc || null,
            artworkUrl: deezerData.album.cover_big || '',
            artworkThumbnail: deezerData.album.cover_small || '',
            releaseDate: deezerData.album.release_date || deezerData.release_date || null,
            popularity: deezerData.rank || 0,
            explicit: deezerData.explicit_lyrics || false,
            previewUrl: deezerData.preview,
            sourceId: deezerData.id,
        };
    }

    static fromSoundCloud(scData: any): UnifiedMetadata {
        return {
            source: 'soundcloud',
            title: scData.title,
            artist: scData.user?.username || 'Unknown Artist',
            album: 'SoundCloud Track',
            duration: Math.floor(scData.duration / 1000),
            isrc: scData.isrc || null,
            artworkUrl: scData.artwork_url?.replace('large', 't500x500') || '',
            artworkThumbnail: scData.artwork_url?.replace('large', 't67x67') || '',
            releaseDate: scData.release_date || null,
            popularity: scData.playback_count || 0,
            explicit: false,
            previewUrl: scData.stream_url,
            sourceId: scData.id,
        };
    }
}