import { YOUTUBE_CLIENTS, getSignatureTimestamp } from './innertube'

export interface PlayerResponse {
  videoDetails?: {
    videoId: string
    title: string
    lengthSeconds: string
    channelId: string
    author: string
  }
  streamingData?: {
    formats: any[]
    adaptiveFormats: any[]
    expiresInSeconds: string
  }
  playabilityStatus?: {
    status: string
    reason?: string
  }
}

export async function getPlayerResponse(videoId: string): Promise<PlayerResponse> {
  let lastError: Error | null = null

  for (const client of YOUTUBE_CLIENTS) {
    try {
      console.log(`📡 Trying client: ${client.name} for video: ${videoId}`)
      
      const timestamp = await getSignatureTimestamp(client)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const response = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${client.key}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': client.userAgent,
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9',
            'Origin': 'https://www.youtube.com',
            'Referer': 'https://www.youtube.com'
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: client.name,
                clientVersion: client.version,
                hl: 'en',
                gl: 'US',
                utcOffsetMinutes: 0,
                ...(client.name === 'ANDROID_MUSIC' && {
                  androidSdkVersion: 30,
                  osName: 'Android',
                  osVersion: '13'
                })
              },
              thirdParty: {
                embedUrl: 'https://www.youtube.com'
              }
            },
            videoId: videoId,
            playbackContext: {
              contentPlaybackContext: {
                signatureTimestamp: timestamp,
                referer: 'https://www.youtube.com',
                vis: 0
              }
            },
            racyCheckOk: true,
            contentCheckOk: true
          })
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Check playability status
      if (data.playabilityStatus?.status === 'ERROR' || 
          data.playabilityStatus?.status === 'LOGIN_REQUIRED') {
        throw new Error(`Video not playable: ${data.playabilityStatus?.reason || 'Unknown reason'}`)
      }

      // Check if we have streaming data
      const hasStreamingData = data.streamingData?.formats?.length > 0 || 
                               data.streamingData?.adaptiveFormats?.length > 0
      
      if (hasStreamingData) {
        console.log(`✅ Got player response with ${client.name}`)
        return data as PlayerResponse
      }

      throw new Error('No streaming data in response')
      
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Unknown error')
      lastError = error
      console.log(`❌ Player request failed for ${client.name}:`, error.message)
      continue
    }
  }

  throw lastError || new Error('All YouTube clients failed to get player response')
}

// Helper function to extract audio formats
export function extractAudioFormats(playerResponse: PlayerResponse): any[] {
  const allFormats = [
    ...(playerResponse.streamingData?.formats || []),
    ...(playerResponse.streamingData?.adaptiveFormats || [])
  ]

  // Filter for audio-only formats
  return allFormats.filter(format => {
    const mimeType = format.mimeType || ''
    return mimeType.includes('audio/webm') || 
           mimeType.includes('audio/mp4') ||
           format.audioQuality
  })
}

// Helper function to get best audio format
export function getBestAudioFormat(playerResponse: PlayerResponse): any | null {
  const audioFormats = extractAudioFormats(playerResponse)
  
  if (audioFormats.length === 0) return null

  // Sort by quality
  audioFormats.sort((a, b) => {
    const getScore = (f: any) => {
      if (f.audioQuality?.includes('HIGH')) return 3
      if (f.audioQuality?.includes('MEDIUM')) return 2
      if (f.audioQuality?.includes('LOW')) return 1
      return f.bitrate || 0
    }
    return getScore(b) - getScore(a)
  })

  return audioFormats[0]
}

// Helper function to check if video is age-restricted
export function isAgeRestricted(playerResponse: PlayerResponse): boolean {
  return playerResponse.playabilityStatus?.status === 'AGE_CHECK_REQUIRED'
}

// Helper function to check if video requires login
export function requiresLogin(playerResponse: PlayerResponse): boolean {
  return playerResponse.playabilityStatus?.status === 'LOGIN_REQUIRED'
}