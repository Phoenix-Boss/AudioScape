// tests/utils/test-helpers.ts

import { TrackMetadata, StreamSaveData } from '../../libs/cache/types';

export class TestHelpers {
  static generateTestTrack(index: number = 1): TrackMetadata {
    return {
      title: `Test Song ${index}`,
      artist: `Test Artist ${index}`,
      album: `Test Album ${index}`,
      isrc: `TEST${String(index).padStart(9, '0')}`,
      duration: 180,
      artworkUrl: `https://example.com/test-${index}.jpg`
    };
  }

  static generateTestStream(trackId: string): StreamSaveData {
    return {
      trackId,
      source: 'youtube',
      streamUrl: `https://youtube.com/watch?v=test${Date.now()}`,
      quality: '128kbps',
      format: 'webm'
    };
  }

  static generateSearchQueries(count: number): string[] {
    const queries = [];
    for (let i = 0; i < count; i++) {
      queries.push(`Test Query ${i} ${Date.now()}`);
    }
    return queries;
  }

  static async measurePerformance<T>(
    fn: () => Promise<T>,
    label: string
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`⏱️ ${label}: ${duration}ms`);
    return { result, duration };
  }

  static async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxAttempts - 1) throw error;
        await sleep(delay);
      }
    }
    throw new Error('Retry failed');
  }
}

// Utility sleep function
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));