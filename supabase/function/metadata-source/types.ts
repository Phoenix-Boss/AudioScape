export interface AudioRequest {
  artist?: string
  title?: string
  isrc?: string
  videoId?: string
}

export interface AudioResult {
  url: string
  videoId: string
  source: 'youtube'
  expires: string
  quality: 'low' | 'medium' | 'high'
  success: boolean
}

export interface YouTubeClient {
  name: string
  version: string
  key: string
  userAgent: string
}

export interface AudioFormat {
  url?: string
  signatureCipher?: string
  mimeType?: string
  audioQuality?: string
  bitrate?: number
}