// supabase/functions/metadata-source/soundcloud-client.ts

export class SoundCloudClient {
    private abortController: AbortController;
    private clientId: string | null = null;
    private oauthToken: string | null = null;
    
    private readonly API_BASE = 'https://api-v2.soundcloud.com';
    private readonly SEARCH_ENDPOINT = '/search/tracks';
    private readonly CLIENT_ID_CACHE_KEY = 'soundcloud_client_id_2026';

    constructor() {
        this.abortController = new AbortController();
    }

    async searchTrack(query: string): Promise<any | null> {
        try {
            // Get working client ID with multiple fallbacks
            if (!this.clientId) {
                await this.initializeClient();
            }

            if (!this.clientId) {
                console.log('❌ No working SoundCloud client ID');
                return null;
            }

            // Build request with all required parameters
            const url = new URL(this.SEARCH_ENDPOINT, this.API_BASE);
            url.searchParams.append('q', query);
            url.searchParams.append('limit', '5');
            url.searchParams.append('client_id', this.clientId);
            url.searchParams.append('access', 'playable,preview');
            url.searchParams.append('app_version', Date.now().toString()); // Dynamic version
            url.searchParams.append('app_locale', 'en');

            console.log(`🔍 Searching SoundCloud with client ID: ${this.clientId.substring(0, 8)}...`);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Origin': 'https://soundcloud.com',
                    'Referer': 'https://soundcloud.com/',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                console.log(`SoundCloud returned ${response.status}`);
                if (response.status === 401) {
                    // Clear invalid client ID
                    this.clientId = null;
                    // Try one more time with fresh ID
                    return this.searchTrack(query);
                }
                return null;
            }

            const data = await response.json();
            
            // Filter for playable tracks
            const tracks = data.collection?.filter((item: any) => 
                item.kind === 'track' && 
                (item.streamable || item.access === 'playable')
            ) || [];

            if (tracks.length === 0) {
                console.log('No playable SoundCloud tracks found');
                return null;
            }

            const track = tracks[0];
            console.log(`✅ SoundCloud found: "${track.title}" by ${track.user?.username}`);
            
            return track;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('SoundCloud search timed out');
            } else {
                console.error('SoundCloud error:', error.message);
            }
            return null;
        }
    }

    private async initializeClient(): Promise<void> {
        // Try multiple methods to get a working client ID
        
        // Method 1: Known working client IDs (updated for 2026)
        const workingIds = [
            'iZIs9mchVcX5lhVRyQGGAYlNkWldX6ie', // Current primary
            'a3e059563d7fd3372b49b37f00a00bcf', // Legacy
            'NONE', // Placeholder - add more as needed
        ];

        for (const id of workingIds) {
            if (await this.testClientId(id)) {
                this.clientId = id;
                console.log(`✅ Using working client ID: ${id.substring(0, 8)}...`);
                return;
            }
        }

        // Method 2: Extract from SoundCloud website
        await this.extractFromWebsite();
    }

    private async extractFromWebsite(): Promise<void> {
        try {
            const response = await fetch('https://soundcloud.com', {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                },
            });

            const html = await response.text();

            // Multiple extraction patterns
            const patterns = [
                /client_id["']?\s*[:=]\s*["']([a-f0-9]{32})["']/i,
                /"clientId":"([a-f0-9]{32})"/i,
                /client_id=([a-f0-9]{32})/i,
                /client_id["']?\s*:\s*["']([a-zA-Z0-9]{32})["']/,
            ];

            for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match && match[1]) {
                    if (await this.testClientId(match[1])) {
                        this.clientId = match[1];
                        console.log(`✅ Extracted working client ID: ${match[1].substring(0, 8)}...`);
                        return;
                    }
                }
            }
        } catch (error) {
            console.log('Website extraction failed:', error.message);
        }
    }

    private async testClientId(clientId: string): Promise<boolean> {
        try {
            const testUrl = new URL(this.SEARCH_ENDPOINT, this.API_BASE);
            testUrl.searchParams.append('q', 'test');
            testUrl.searchParams.append('limit', '1');
            testUrl.searchParams.append('client_id', clientId);
            
            const response = await fetch(testUrl.toString(), {
                method: 'HEAD',
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                },
            });
            
            return response.ok;
        } catch {
            return false;
        }
    }

    abort() {
        this.abortController.abort();
    }
}