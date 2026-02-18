// supabase/functions/unified-metadata/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SpotifyClient } from './spotify-client';
import { DeezerClient } from './deezer-client';
import { SoundCloudClient } from './soundcloud-client'
import { MetadataTransformer } from './transformers';
import { FunctionResponse, SettledResult } from './types';

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    const startTime = Date.now();
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Only accept POST
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        // Parse request body
        const body = await req.json().catch(() => ({}));
        const { query } = body;
        
        if (!query || typeof query !== 'string' || query.trim() === '') {
            return new Response(JSON.stringify({ 
                error: 'Valid query string is required' 
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const trimmedQuery = query.trim();
        console.log(`\n🎵 SEARCHING FOR: "${trimmedQuery}"`);
        console.log('='.repeat(50));

        // Initialize clients
        const spotify = new SpotifyClient();
        const deezer = new DeezerClient();
        const soundcloud = new SoundCloudClient();

        // Set timeout (5 seconds)
        const timeoutMs = 5000;
        let timeoutId: number | undefined;

        const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('Search timeout - took longer than 5 seconds'));
            }, timeoutMs);
        });

        try {
            // Search all sources in parallel with timeout
            const results = await Promise.race([
                Promise.allSettled([
                    spotify.searchTrack(trimmedQuery),
                    deezer.searchTrack(trimmedQuery),
                    soundcloud.searchTrack(trimmedQuery),
                ]),
                timeoutPromise,
            ]) as PromiseSettledResult<any>[];

            // Clear timeout if we got results
            if (timeoutId) clearTimeout(timeoutId);

            const [spotifyResult, deezerResult, soundcloudResult] = results;

            // Log results status
            console.log('\n📊 Search Results:');
            console.log(`   Spotify: ${spotifyResult.status === 'fulfilled' && spotifyResult.value ? '✅ Found' : '❌ Not found'}`);
            console.log(`   Deezer: ${deezerResult.status === 'fulfilled' && deezerResult.value ? '✅ Found' : '❌ Not found'}`);
            console.log(`   SoundCloud: ${soundcloudResult.status === 'fulfilled' && soundcloudResult.value ? '✅ Found' : '❌ Not found'}`);

            // Check results in priority order: Spotify > Deezer > SoundCloud
            if (spotifyResult.status === 'fulfilled' && spotifyResult.value) {
                console.log('\n✅ Using Spotify result');
                const metadata = MetadataTransformer.fromSpotify(spotifyResult.value);
                MetadataTransformer.logMetadata(metadata);
                
                const response: FunctionResponse = {
                    success: true,
                    source: 'spotify',
                    data: { track: metadata },
                    responseTime: Date.now() - startTime,
                };
                
                return new Response(JSON.stringify(response), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            if (deezerResult.status === 'fulfilled' && deezerResult.value) {
                console.log('\n✅ Using Deezer result');
                const metadata = MetadataTransformer.fromDeezer(deezerResult.value);
                MetadataTransformer.logMetadata(metadata);
                
                const response: FunctionResponse = {
                    success: true,
                    source: 'deezer',
                    data: { track: metadata },
                    responseTime: Date.now() - startTime,
                };
                
                return new Response(JSON.stringify(response), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            if (soundcloudResult.status === 'fulfilled' && soundcloudResult.value) {
                console.log('\n✅ Using SoundCloud result');
                const metadata = MetadataTransformer.fromSoundCloud(soundcloudResult.value);
                MetadataTransformer.logMetadata(metadata);
                
                const response: FunctionResponse = {
                    success: true,
                    source: 'soundcloud',
                    data: { track: metadata },
                    responseTime: Date.now() - startTime,
                };
                
                return new Response(JSON.stringify(response), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // Log failures if all sources failed
            console.log('\n❌ All sources failed:');
            if (spotifyResult.status === 'rejected') {
                console.log(`   Spotify error: ${spotifyResult.reason?.message || 'Unknown'}`);
            }
            if (deezerResult.status === 'rejected') {
                console.log(`   Deezer error: ${deezerResult.reason?.message || 'Unknown'}`);
            }
            if (soundcloudResult.status === 'rejected') {
                console.log(`   SoundCloud error: ${soundcloudResult.reason?.message || 'Unknown'}`);
            }

            // No results from any source
            const response: FunctionResponse = {
                success: false,
                source: 'none',
                error: 'No results found from any source',
                responseTime: Date.now() - startTime,
            };
            
            return new Response(JSON.stringify(response), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });

        } finally {
            // Clean up timeout if it exists
            if (timeoutId) clearTimeout(timeoutId);
            
            // Abort any pending requests
            spotify.abort();
            deezer.abort();
            soundcloud.abort();
        }

    } catch (error) {
        console.error('❌ Function error:', error.message);
        
        const response: FunctionResponse = {
            success: false,
            source: 'none',
            error: error.message || 'Internal server error',
            responseTime: Date.now() - startTime,
        };
        
        return new Response(JSON.stringify(response), {
            status: error.message.includes('timeout') ? 408 : 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});