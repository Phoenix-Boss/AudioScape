// supabase/functions/metadata-source/transformers.ts

import { UnifiedMetadata } from './types';

export class MetadataTransformer {
    
    static fromSpotify(data: any): UnifiedMetadata {
        return {
            source: 'spotify',
            title: data.name || 'Unknown Title',
            artist: data.artists?.[0]?.name || 'Unknown Artist',
            artistId: data.artists?.[0]?.id,
            album: data.album?.name || 'Unknown Album',
            albumId: data.album?.id,
            duration: Math.floor((data.duration_ms || 0) / 1000),
            isrc: data.external_ids?.isrc || null,
            artworkUrl: data.album?.images?.[0]?.url || '',
            artworkThumbnail: data.album?.images?.[2]?.url || data.album?.images?.[0]?.url || '',
            artworkMedium: data.album?.images?.[1]?.url || '',
            releaseDate: data.album?.release_date || null,
            popularity: data.popularity || 0,
            explicit: data.explicit || false,
            previewUrl: data.preview_url || null,
            sourceId: data.id || 'unknown',
            trackNumber: data.track_number,
            discNumber: data.disc_number,
        };
    }

    static fromDeezer(data: any): UnifiedMetadata {
        return {
            source: 'deezer',
            title: data.title || 'Unknown Title',
            artist: data.artist?.name || 'Unknown Artist',
            artistId: data.artist?.id,
            album: data.album?.title || 'Unknown Album',
            albumId: data.album?.id,
            duration: data.duration || 0,
            isrc: data.isrc || null,
            artworkUrl: data.album?.cover_big || data.album?.cover_medium || '',
            artworkThumbnail: data.album?.cover_small || '',
            artworkMedium: data.album?.cover_medium || '',
            releaseDate: data.album?.release_date || data.release_date || null,
            popularity: data.rank || 0,
            explicit: data.explicit_lyrics || false,
            previewUrl: data.preview || null,
            sourceId: data.id || 0,
            trackNumber: data.track_position,
            discNumber: data.disk_number,
        };
    }

    static fromSoundCloud(data: any): UnifiedMetadata {
        // Handle artwork URL transformation
        let artworkUrl = data.artwork_url || data.user?.avatar_url || '';
        let artworkThumbnail = artworkUrl;
        
        if (artworkUrl) {
            artworkUrl = artworkUrl.replace('large', 't500x500');
            artworkThumbnail = artworkThumbnail.replace('large', 't67x67');
        }

        // Parse release date from various formats
        let releaseDate = null;
        if (data.release_date) {
            releaseDate = data.release_date;
        } else if (data.created_at) {
            releaseDate = data.created_at.split('T')[0];
        }

        return {
            source: 'soundcloud',
            title: data.title || 'Unknown Title',
            artist: data.user?.full_name || data.user?.username || 'Unknown Artist',
            artistId: data.user?.id,
            album: 'SoundCloud Track',
            duration: Math.floor((data.duration || 0) / 1000),
            isrc: data.isrc || null,
            artworkUrl: artworkUrl,
            artworkThumbnail: artworkThumbnail,
            artworkMedium: artworkUrl.replace('t500x500', 't300x300'),
            releaseDate: releaseDate,
            popularity: data.playback_count || data.likes_count || 0,
            explicit: data.tag_list?.toLowerCase().includes('explicit') || false,
            previewUrl: data.stream_url || null,
            sourceId: data.id || 0,
            genre: data.genre,
            label: data.label_name,
        };
    }

    static logMetadata(metadata: UnifiedMetadata) {
        console.log(`\n📦 Metadata from ${metadata.source}:`);
        console.log(`   Title: ${metadata.title}`);
        console.log(`   Artist: ${metadata.artist}`);
        console.log(`   Album: ${metadata.album}`);
        console.log(`   ISRC: ${metadata.isrc || 'N/A'}`);
        console.log(`   Duration: ${metadata.duration}s`);
        console.log(`   Release: ${metadata.releaseDate || 'N/A'}`);
        console.log(`   Popularity: ${metadata.popularity}`);
        console.log(`   Explicit: ${metadata.explicit ? 'Yes' : 'No'}`);
    }
}