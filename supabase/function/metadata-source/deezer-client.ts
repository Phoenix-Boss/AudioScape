// supabase/functions/unified-metadata/deezer-client.ts

export class DeezerClient {
    private abortController: AbortController;
    private readonly API_BASE = 'https://api.deezer.com';
    private readonly SEARCH_ENDPOINT = '/search';

    constructor() {
        this.abortController = new AbortController();
    }

    async searchTrack(query: string): Promise<any | null> {
        try {
            const url = new URL(this.SEARCH_ENDPOINT, this.API_BASE);
            url.searchParams.append('q', query);
            url.searchParams.append('limit', '5');

            console.log(`🔍 Searching Deezer (public API): "${query}"`);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                console.log(`Deezer returned ${response.status}`);
                return null;
            }

            const data = await response.json();
            
            if (!data.data || data.data.length === 0) {
                return null;
            }

            // Return the best match
            return data.data[0];

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Deezer search timed out');
            } else {
                console.error('Deezer error:', error);
            }
            return null;
        }
    }

    abort() {
        this.abortController.abort();
    }
}