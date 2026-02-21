import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { searchYouTube } from './search.ts'
import { getPlayerResponse, getBestAudioFormat } from './player.ts'
import { decipherSignature } from './decipher.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const body = await req.json().catch(() => null)
    
    if (!body) {
      throw new Error('Invalid JSON in request body')
    }

    const { artist, title, isrc, videoId } = body

    if (!videoId && !artist && !title) {
      throw new Error('Missing required fields: provide either videoId or artist+title')
    }

    let targetVideoId = videoId

    if (!targetVideoId) {
      if (!artist || !title) {
        throw new Error('Artist and title required for search')
      }

      console.log(`🔍 Searching YouTube for: ${artist} - ${title}`)
      
      const searchQuery = isrc ? `ISRC:${isrc}` : `${artist} ${title} audio`
      targetVideoId = await searchYouTube(searchQuery)
      
      if (!targetVideoId) {
        throw new Error('No video found on YouTube')
      }
      
      console.log(`✅ Found video: ${targetVideoId}`)
    }

    // THIS IS WHERE WE USE THE PLAYER.TS FUNCTION
    console.log(`📡 Getting stream for video: ${targetVideoId}`)
    const playerResponse = await getPlayerResponse(targetVideoId)
    
    const audioFormat = getBestAudioFormat(playerResponse)
    
    if (!audioFormat) {
      throw new Error('No audio format available')
    }

    // Get playable URL
    let streamUrl: string
    if (audioFormat.url) {
      streamUrl = audioFormat.url
    } else if (audioFormat.signatureCipher) {
      streamUrl = await decipherSignature(audioFormat.signatureCipher)
    } else {
      throw new Error('No playable URL found')
    }

    const result = {
      url: streamUrl,
      videoId: targetVideoId,
      source: 'youtube',
      expires: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      quality: audioFormat.audioQuality?.toLowerCase() || 
               (audioFormat.bitrate > 128000 ? 'high' : 'medium'),
      success: true
    }

    return new Response(
      JSON.stringify(result), {
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=21600'
        }
      }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error:', errorMessage)
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false
      }), {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )
  }
})