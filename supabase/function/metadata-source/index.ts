// supabase/functions/metadata-source/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { SpotifyClient } from './spotify-client.ts';
import { DeezerClient } from './deezer-client.ts';
import { SoundCloudClient } from './soundcloud-client.ts';
import { MetadataTransformer } from './transformers.ts';
import { FunctionResponse } from './types.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    const startTime = Date.now();
    
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const { query } = body;
        
        if (!query || typeof query !== 'string' || query.trim() === '') {
            return new Response(JSON.stringify({ error: 'Valid query string is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const trimmedQuery = query.trim();
        console.log(`\n🎵 SEARCHING: "${trimmedQuery}"`);
        console.log('='.repeat(50));

        // Initialize clients
        const spotify = new SpotifyClient();
        const deezer = new DeezerClient();
        const soundcloud = new SoundCloudClient();

        // Set timeout (8 seconds for slower APIs)
        const timeoutMs = 8000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            // Search all sources in parallel
            const [spotifyResult, deezerResult, soundcloudResult] = await Promise.allSettled([
                spotify.searchTrack(trimmedQuery),
                deezer.searchTrack(trimmedQuery),
                soundcloud.searchTrack(trimmedQuery),
            ]);

            clearTimeout(timeoutId);

            // Log results
            console.log('\n📊 Results:');
            console.log(`   Spotify: ${spotifyResult.status === 'fulfilled' && spotifyResult.value ? '✅ Found' : '❌'}`);
            console.log(`   Deezer: ${deezerResult.status === 'fulfilled' && deezerResult.value ? '✅ Found' : '❌'}`);
            console.log(`   SoundCloud: ${soundcloudResult.status === 'fulfilled' && soundcloudResult.value ? '✅ Found' : '❌'}`);

            // Priority order: Spotify > Deezer > SoundCloud
            if (spotifyResult.status === 'fulfilled' && spotifyResult.value) {
                const metadata = MetadataTransformer.fromSpotify(spotifyResult.value);
                MetadataTransformer.logMetadata(metadata);
                
                return new Response(JSON.stringify({
                    success: true,
                    source: 'spotify',
                    data: { track: metadata },
                    responseTime: Date.now() - startTime,
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            if (deezerResult.status === 'fulfilled' && deezerResult.value) {
                const metadata = MetadataTransformer.fromDeezer(deezerResult.value);
                MetadataTransformer.logMetadata(metadata);
                
                return new Response(JSON.stringify({
                    success: true,
                    source: 'deezer',
                    data: { track: metadata },
                    responseTime: Date.now() - startTime,
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            if (soundcloudResult.status === 'fulfilled' && soundcloudResult.value) {
                const metadata = MetadataTransformer.fromSoundCloud(soundcloudResult.value);
                MetadataTransformer.logMetadata(metadata);
                
                return new Response(JSON.stringify({
                    success: true,
                    source: 'soundcloud',
                    data: { track: metadata },
                    responseTime: Date.now() - startTime,
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // Log failures
            console.log('\n❌ All sources failed:');
            if (spotifyResult.status === 'rejected') console.log(`   Spotify: ${spotifyResult.reason?.message}`);
            if (deezerResult.status === 'rejected') console.log(`   Deezer: ${deezerResult.reason?.message}`);
            if (soundcloudResult.status === 'rejected') console.log(`   SoundCloud: ${soundcloudResult.reason?.message}`);

            return new Response(JSON.stringify({
                success: false,
                source: 'none',
                error: 'No results found from any source',
                responseTime: Date.now() - startTime,
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });

        } finally {
            clearTimeout(timeoutId);
            spotify.abort();
            deezer.abort();
            soundcloud.abort();
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        
        return new Response(JSON.stringify({
            success: false,
            source: 'none',
            error: error.message,
            responseTime: Date.now() - startTime,
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});