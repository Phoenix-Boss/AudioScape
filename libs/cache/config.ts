// libs/cache/config.ts

export interface CacheConfig {
  device: {
    enabled: boolean;
    maxItems: number;
    ttlSeconds: number;
    storagePrefix: string;
  };
  supabase: {
    enabled: boolean;
    url: string;
    key: string;
    serviceKey: string;
    ttlSeconds: number;
  };
  keys: {
    searchPrefix: string;
    trackPrefix: string;
    streamPrefix: string;
    artistPrefix: string;
    relatedPrefix: string;
  };
}

// 🔥 IMPORTANT: Use function instead of static object
export function getConfig(): CacheConfig {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url) {
    throw new Error('❌ EXPO_PUBLIC_SUPABASE_URL is missing');
  }

  if (!key) {
    throw new Error('❌ EXPO_PUBLIC_SUPABASE_ANON_KEY is missing');
  }

  return {
    device: {
      enabled: true,
      maxItems: 100,
      ttlSeconds: 86400,
      storagePrefix: '@mavin_cache_',
    },
    supabase: {
      enabled: true,
      url,
      key,
      serviceKey: serviceKey || '',
      ttlSeconds: 2592000,
    },
    keys: {
      searchPrefix: 'search:',
      trackPrefix: 'track:',
      streamPrefix: 'stream:',
      artistPrefix: 'artist:',
      relatedPrefix: 'related:',
    },
  };
}
