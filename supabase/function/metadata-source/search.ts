// Public InnerTube keys from YouTube's apps (NOT secret)
const YOUTUBE_CLIENTS = [
  {
    name: 'ANDROID_MUSIC',
    version: '5.28.1',
    key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
    userAgent: 'com.google.android.apps.youtube.music/5.28.1 (Linux; U; Android 13) gzip'
  },
  {
    name: 'WEB_REMIX',
    version: '1.20240615.00.00',
    key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  {
    name: 'IOS_MUSIC',
    version: '5.28',
    key: 'AIzaSyBAETezhkwP0ZWA02RsqT1zuOpxFpe0pIw',
    userAgent: 'com.google.ios.youtubemusic/5.28 (iPhone; CPU iOS 16_0 like Mac OS X)'
  },
  {
    name: 'ANDROID',
    version: '19.29',
    key: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
    userAgent: 'com.google.android.youtube/19.29 (Linux; U; Android 13)'
  }
]

export async function searchYouTube(query: string): Promise<string | null> {
  for (const client of YOUTUBE_CLIENTS) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(
        `https://music.youtube.com/youtubei/v1/search?key=${client.key}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': client.userAgent,
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: client.name,
                clientVersion: client.version,
                hl: 'en',
                gl: 'US',
                utcOffsetMinutes: 0
              }
            },
            query: query
          })
        }
      )

      clearTimeout(timeoutId)

      if (!response.ok) continue

      const data = await response.json()
      const videoId = extractVideoId(data)
      
      if (videoId) {
        console.log(`✅ Found video with ${client.name}`)
        return videoId
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error'
      console.log(`Search failed for ${client.name}:`, error)
      continue
    }
  }

  return null
}

function extractVideoId(data: any): string | null {
  try {
    const contents = 
      data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.sectionListRenderer?.contents ||
      data.contents?.sectionListRenderer?.contents ||
      []

    for (const section of contents) {
      const items = 
        section.musicShelfRenderer?.contents ||
        section.musicPlaylistShelfRenderer?.contents ||
        []

      for (const item of items) {
        const renderer = item.musicResponsiveListItemRenderer
        if (!renderer) continue

        const videoId = renderer.navigationEndpoint?.watchEndpoint?.videoId
        if (videoId) return videoId
      }
    }
  } catch (e) {
    console.log('Error parsing search response:', e)
  }

  return null
}