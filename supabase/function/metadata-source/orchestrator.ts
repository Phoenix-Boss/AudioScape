// supabase/functions/unified-metadata/orchestrator.ts

import { SpotifyClient } from './spotify-client.ts';
import { DeezerClient } from './deezer-client.ts';
import { SoundCloudClient } from './soundcloud-client.ts';
import { MetadataTransformer } from './transformer.ts';
import { UnifiedMetadata, FunctionResponse } from './types.ts';

export class SourceOrchestrator {
    private spotify: SpotifyClient;
    private deezer: DeezerClient;
    private soundcloud: SoundCloudClient;
    private startTime: number;

    constructor() {
        this.spotify = new SpotifyClient();
        this.deezer = new DeezerClient();
        this.soundcloud = new SoundCloudClient();
        this.startTime = Date.now();
    }

    async search(query: string): Promise<FunctionResponse> {
        console.log(`\n🎵 ORCHESTRATOR: Searching for "${query}"`);
        console.log('='.repeat(50));

        // Set timeout (5 seconds)
        const timeoutMs = 5000;
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Search timeout')), timeoutMs);
        });

        try {
            // Search all sources in parallel
            const [spotifyResult, deezerResult, soundcloudResult] = await Promise.race([
                Promise.allSettled([
                    this.spotify.searchTrack(query),
                    this.deezer.searchTrack(query),
                    this.soundcloud.searchTrack(query),
                ]),
                timeoutPromise,
            ]) as PromiseSettledResult<any>[];

            // Check results in priority order: Spotify > Deezer > SoundCloud
            const result = this.getBestResult(
                spotifyResult, 
                deezerResult, 
                soundcloudResult
            );

            if (result) {
                return {
                    success: true,
                    source: result.source,
                    data: { track: result.metadata },
                    responseTime: Date.now() - this.startTime,
                };
            }

            // No results from any source
            return {
                success: false,
                source: 'none',
                error: 'No results found from any source',
                responseTime: Date.now() - this.startTime,
            };

        } catch (error) {
            // Timeout or other error
            this.abortAll();
            
            return {
                success: false,
                source: 'none',
                error: error.message,
                responseTime: Date.now() - this.startTime,
            };
        }
    }

    private getBestResult(
        spotifyResult: PromiseSettledResult<any>,
        deezerResult: PromiseSettledResult<any>,
        soundcloudResult: PromiseSettledResult<any>
    ): { source: 'spotify' | 'deezer' | 'soundcloud'; metadata: UnifiedMetadata } | null {
        
        // Priority 1: Spotify (best metadata)
        if (spotifyResult.status === 'fulfilled' && spotifyResult.value) {
            console.log('✅ Priority 1: Found on Spotify');
            return {
                source: 'spotify',
                metadata: MetadataTransformer.fromSpotify(spotifyResult.value),
            };
        }

        // Priority 2: Deezer (good metadata)
        if (deezerResult.status === 'fulfilled' && deezerResult.value) {
            console.log('✅ Priority 2: Found on Deezer');
            return {
                source: 'deezer',
                metadata: MetadataTransformer.fromDeezer(deezerResult.value),
            };
        }

        // Priority 3: SoundCloud (basic metadata)
        if (soundcloudResult.status === 'fulfilled' && soundcloudResult.value) {
            console.log('✅ Priority 3: Found on SoundCloud');
            return {
                source: 'soundcloud',
                metadata: MetadataTransformer.fromSoundCloud(soundcloudResult.value),
            };
        }

        // Log failures for monitoring
        this.logFailures(spotifyResult, deezerResult, soundcloudResult);
        
        return null;
    }

    private logFailures(
        spotifyResult: PromiseSettledResult<any>,
        deezerResult: PromiseSettledResult<any>,
        soundcloudResult: PromiseSettledResult<any>
    ) {
        if (spotifyResult.status === 'rejected') {
            console.log('❌ Spotify failed:', spotifyResult.reason?.message);
        } else if (!spotifyResult.value) {
            console.log('❌ Spotify: No results');
        }

        if (deezerResult.status === 'rejected') {
            console.log('❌ Deezer failed:', deezerResult.reason?.message);
        } else if (!deezerResult.value) {
            console.log('❌ Deezer: No results');
        }

        if (soundcloudResult.status === 'rejected') {
            console.log('❌ SoundCloud failed:', soundcloudResult.reason?.message);
        } else if (!soundcloudResult.value) {
            console.log('❌ SoundCloud: No results');
        }
    }

    private abortAll() {
        this.spotify.abort();
        this.deezer.abort();
        this.soundcloud.abort();
    }
}