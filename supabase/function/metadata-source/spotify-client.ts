// supabase/functions/unified-metadata/spotify-client.ts

// Import spotify-url-info (works in Deno via npm: specifier)
import { getPreview, getData } from 'npm:spotify-url-info@2.2.0';

export class SpotifyClient {
    private abortController: AbortController;

    constructor() {
        this.abortController = new AbortController();
    }

    async searchTrack(query: string): Promise<any | null> {
        try {
            console.log(`🔍 Searching Spotify (via spotify-url-info): "${query}"`);
            
            // Step 1: Search using a public Spotify search page (as a fallback)
            // spotify-url-info doesn't have direct search, so we need to:
            // A) First search Spotify web for the track URL, or
            // B) Use a search service to find the track ID
            
            // Method: Use Spotify's public search endpoint (no auth needed for basic HTML)
            const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`;
            
            // We need to make this request with a browser-like User-Agent
            const searchResponse = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json',
                },
                signal: this.abortController.signal,
            });

            if (!searchResponse.ok) {
                console.log(`Spotify search returned ${searchResponse.status}`);
                return this.fallbackToDirectPreview(query);
            }

            const searchData = await searchResponse.json();
            
            if (!searchData.tracks?.items?.length) {
                return this.fallbackToDirectPreview(query);
            }

            // Get the first track's ID and construct URL
            const trackId = searchData.tracks.items[0].id;
            const trackUrl = `https://open.spotify.com/track/${trackId}`;
            
            console.log(`Found track URL: ${trackUrl}`);
            
            // Use spotify-url-info to get detailed metadata
            const metadata = await getData(trackUrl);
            
            // Transform to our format
            return this.transformSpotifyData(metadata);

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Spotify search timed out');
            } else {
                console.error('Spotify error:', error);
            }
            
            // Try one more method
            return this.fallbackToDirectPreview(query);
        }
    }

    private async fallbackToDirectPreview(query: string): Promise<any | null> {
        try {
            // Sometimes you can get preview info directly
            const preview = await getPreview(query);
            if (preview) {
                return this.transformPreviewData(preview);
            }
        } catch (e) {
            // Ignore, just return null
        }
        return null;
    }

    private transformSpotifyData(data: any): any {
        return {
            id: data.id,
            name: data.name,
            artists: data.artists,
            album: {
                name: data.album?.name || 'Unknown Album',
                releaseDate: data.album?.release_date,
                images: data.album?.images || [],
            },
            duration: Math.floor(data.duration / 1000), // Convert ms to seconds
            isrc: data.external_ids?.isrc,
            previewUrl: data.preview_url,
            popularity: data.popularity,
            explicit: data.explicit,
        };
    }

    private transformPreviewData(preview: any): any {
        return {
            id: preview.id || 'unknown',
            name: preview.title,
            artists: [{ name: preview.artist }],
            album: {
                name: 'Unknown Album',
                releaseDate: preview.date,
                images: preview.image ? [{ url: preview.image }] : [],
            },
            duration: preview.duration || 0,
            isrc: preview.isrc,
            previewUrl: preview.audio,
            popularity: 50,
            explicit: false,
        };
    }

    abort() {
        this.abortController.abort();
    }
}