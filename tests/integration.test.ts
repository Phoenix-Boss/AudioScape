// tests/integration.test.ts

import { cache, initCache, deviceCache, supabaseCache } from '../libs/cache';
import { TrackMetadata, StreamSaveData } from '../libs/cache/types';

console.log('🧪 Starting Integration Tests...');
console.log('Imported modules:', {
  cache: !!cache,
  initCache: !!initCache,
  deviceCache: !!deviceCache,
  supabaseCache: !!supabaseCache
});

describe('Mavin Cache System Integration Tests', () => {
  const testQuery = 'Test Artist Test Song';
  const testTrack: TrackMetadata = {
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    isrc: 'TEST123456789',
    duration: 180,
    artworkUrl: 'https://example.com/test.jpg'
  };
  
  const testStream: StreamSaveData = {
    trackId: '', // Will be set after save
    source: 'youtube',
    streamUrl: 'https://youtube.com/watch?v=test123',
    quality: '128kbps',
    format: 'webm'
  };

  beforeAll(() => {
    console.log('🔧 beforeAll: Initializing cache');
    initCache();
    console.log('✅ Cache initialized');
  });

  beforeEach(async () => {
    console.log('🧹 beforeEach: Clearing device cache');
    await deviceCache.clear();
    console.log('✅ Device cache cleared');
  });

  test('should miss cache for first search', async () => {
    console.log('\n🔍 Test: Cache Miss');
    const result = await cache.getSearch(testQuery);
    console.log('Result:', result ? 'FOUND' : 'MISS (expected)');
    expect(result).toBeNull();
  });

  test('should save to cache successfully', async () => {
    console.log('\n💾 Test: Save to Cache');
    const saveResult = await cache.saveSearch(testQuery, testTrack, testStream);
    console.log('Save result:', saveResult);
    expect(saveResult).toBe(true);
  });

  test('should hit cache after save', async () => {
    console.log('\n🎯 Test: Cache Hit');
    
    // First save
    console.log('Saving test data...');
    await cache.saveSearch(testQuery, testTrack, testStream);
    
    // Then search
    console.log('Searching...');
    const result = await cache.getSearch(testQuery);
    
    console.log('Search result:', {
      found: !!result,
      track: result?.track,
      source: result?.source
    });
    
    expect(result).not.toBeNull();
    expect(result?.track.title).toBe(testTrack.title);
    expect(result?.track.artist).toBe(testTrack.artist);
    expect(result?.source).toBe('device');
  });

  test('should get track by ID', async () => {
    console.log('\n🆔 Test: Get Track by ID');
    
    // Save track first
    console.log('Saving track...');
    const trackId = await supabaseCache.saveTrack(testTrack);
    console.log('Track ID:', trackId);
    expect(trackId).not.toBeNull();
    
    if (trackId) {
      const track = await cache.getTrack(trackId);
      console.log('Retrieved track:', track);
      expect(track).not.toBeNull();
      expect(track?.title).toBe(testTrack.title);
    }
  });

  test('should handle multiple searches', async () => {
    console.log('\n🔢 Test: Multiple Searches');
    const searches = [
      'Artist One Song One',
      'Artist Two Song Two',
      'Artist Three Song Three'
    ];
    
    for (const query of searches) {
      console.log(`\nTesting query: "${query}"`);
      const before = await cache.getSearch(query);
      console.log('Before save:', before ? 'HIT' : 'MISS (expected)');
      expect(before).toBeNull();
      
      await cache.saveSearch(query, {
        ...testTrack,
        title: query,
        artist: 'Various'
      }, testStream);
      console.log('Saved successfully');
      
      const after = await cache.getSearch(query);
      console.log('After save:', after ? 'HIT' : 'MISS');
      expect(after).not.toBeNull();
    }
  });

  test('should get cache statistics', async () => {
    console.log('\n📊 Test: Cache Statistics');
    const stats = await cache.getStats();
    console.log('Stats:', JSON.stringify(stats, null, 2));
    
    expect(stats).toHaveProperty('device');
    expect(stats).toHaveProperty('supabase');
    expect(stats).toHaveProperty('timestamp');
    expect(stats.device).toHaveProperty('size');
    expect(stats.device).toHaveProperty('maxSize');
  });

  afterAll(async () => {
    console.log('\n🧹 afterAll: Final cleanup');
    await deviceCache.clear();
    console.log('✅ Cleanup complete');
  });
});