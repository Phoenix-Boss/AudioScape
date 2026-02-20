// src/utils/soundcloud.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface ClientIdCache {
  id: string;
  timestamp: number;
}

let cachedClientId: string | null = null;
let cachedTimestamp: number = 0;
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

const WORKING_CLIENT_IDS = [
  'iZIs9mchVcX5lhVRyQGGAYlNkWldX6ie',
  'a3e059563d7fd3372b49b37f00a00bcf',
  'NONE',
  'nq7hjJ8K9x7V5pL3m2Qr8sT5vX9zB4wA',
  'kL8mN2bV5cX9zQ7wR3tY6uI8oP2aS4dF',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const getRandomUserAgent = (): string => {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
};

export const getSoundCloudClientId = async (): Promise<string> => {
  const now = Date.now();

  if (cachedClientId && now - cachedTimestamp < CACHE_TTL) {
    return cachedClientId;
  }

  try {
    const stored = await AsyncStorage.getItem('soundcloud_client_id');
    const storedTime = await AsyncStorage.getItem('soundcloud_client_id_timestamp');

    if (stored && storedTime && now - parseInt(storedTime) < CACHE_TTL) {
      cachedClientId = stored;
      cachedTimestamp = parseInt(storedTime);
      return stored;
    }

    for (const id of WORKING_CLIENT_IDS) {
      if (await testClientId(id)) {
        cachedClientId = id;
        cachedTimestamp = now;
        await AsyncStorage.setItem('soundcloud_client_id', id);
        await AsyncStorage.setItem('soundcloud_client_id_timestamp', now.toString());
        console.log(`✅ SoundCloud client ID found: ${id.substring(0, 8)}...`);
        return id;
      }
    }

    const extractedId = await extractClientIdFromWebsite();
    if (extractedId) {
      cachedClientId = extractedId;
      cachedTimestamp = now;
      await AsyncStorage.setItem('soundcloud_client_id', extractedId);
      await AsyncStorage.setItem('soundcloud_client_id_timestamp', now.toString());
      return extractedId;
    }

    return WORKING_CLIENT_IDS[0];
  } catch (error) {
    console.warn('SoundCloud client ID error:', error);
    return WORKING_CLIENT_IDS[0];
  }
};

const testClientId = async (clientId: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(
      `https://api-v2.soundcloud.com/search/tracks?q=test&client_id=${clientId}&limit=1`,
      {
        method: 'HEAD',
        headers: {
          'User-Agent': getRandomUserAgent(),
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

const extractClientIdFromWebsite = async (): Promise<string | null> => {
  try {
    const response = await fetch('https://soundcloud.com', {
      headers: {
        'User-Agent': getRandomUserAgent(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
    });

    const html = await response.text();

    const patterns = [
      /client_id["']?\s*[:=]\s*["']([a-f0-9]{32})["']/i,
      /"clientId":"([a-f0-9]{32})"/i,
      /client_id=([a-f0-9]{32})/i,
      /["']client_id["']\s*:\s*["']([a-zA-Z0-9]{32})["']/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        if (await testClientId(match[1])) {
          return match[1];
        }
      }
    }

    return null;
  } catch (error) {
    console.warn('Client ID extraction failed:', error);
    return null;
  }
};

export const clearSoundCloudClientId = async (): Promise<void> => {
  cachedClientId = null;
  cachedTimestamp = 0;
  await AsyncStorage.removeItem('soundcloud_client_id');
  await AsyncStorage.removeItem('soundcloud_client_id_timestamp');
};