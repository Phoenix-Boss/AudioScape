// Public InnerTube keys from YouTube's apps (NOT secret)
export const YOUTUBE_CLIENTS = [
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

export async function getSignatureTimestamp(client: any): Promise<number> {
  try {
    const response = await fetch('https://www.youtube.com', {
      headers: { 'User-Agent': client.userAgent }
    })
    const html = await response.text()
    const match = html.match(/"signatureTimestamp":(\d+)/)
    return match ? parseInt(match[1]) : Math.floor(Date.now() / 1000)
  } catch {
    return Math.floor(Date.now() / 1000)
  }
}