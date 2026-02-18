// supabase/functions/unified-metadata/soundcloud-client.ts

export class SoundCloudClient {
    private abortController: AbortController;
    private clientId: string | null = null;
    
    private readonly API_BASE = 'https://api-v2.soundcloud.com';
    private readonly SEARCH_ENDPOINT = '/search/tracks';

    constructor() {
        this.abortController = new AbortController();
    }

    async searchTrack(query: string): Promise<any | null> {
        try {
            // Get a working client ID
            if (!this.clientId) {
                await this.discoverClientId();
            }

            if (!this.clientId) {
                // Known working client ID (fallback)
                this.clientId = 'a3e059563d7fd3372b49b37f00a00bcf';
            }

            const url = new URL(this.SEARCH_ENDPOINT, this.API_BASE);
            url.searchParams.append('q', query);
            url.searchParams.append('limit', '5');
            url.searchParams.append('client_id', this.clientId);
            url.searchParams.append('access', 'playable,preview');

            console.log(`🔍 Searching SoundCloud (unofficial): "${query}"`);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; MavinBot/1.0)',
                },
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                console.log(`SoundCloud returned ${response.status}`);
                return null;
            }

            const data = await response.json();
            
            const tracks = data.collection?.filter((item: any) => 
                item.kind === 'track' && item.streamable
            ) || [];

            if (tracks.length === 0) return null;

            return tracks[0];

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('SoundCloud search timed out');
            } else {
                console.error('SoundCloud error:', error);
            }
            return null;
        }
    }

    private async discoverClientId(): Promise<void> {
        try {
            const response = await fetch('https://soundcloud.com', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
            });
            
            const html = await response.text();
            
            // Look for client ID in script tags
            const match = html.match(/client_id:["']([a-zA-Z0-9]{32})["']/);
            
            if (match && match[1]) {
                this.clientId = match[1];
                console.log('✅ Discovered SoundCloud client ID');
            }
        } catch (error) {
            console.log('Client ID discovery failed');
        }
    }

    abort() {
        this.abortController.abort();
    }
}