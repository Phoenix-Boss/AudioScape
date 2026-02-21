// src/__tests__/api.test.ts
import getTrack from '../services/api/track/get';
import searchGet from '../services/api/search/get';
import getPlayerSearch from '../services/api/player/search/get';
import { getSoundCloudClientId } from '../utils/soundcloud';
import { CacheFortress } from '../services/cache/fortress';

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds

describe('Step 3 - Metadata API Tests', () => {
  
  beforeAll(async () => {
    // Clear cache before tests
    await CacheFortress.clear();
    console.log('🧹 Cache cleared for tests');
  });

  test('SoundCloud Client ID works', async () => {
    const clientId = await getSoundCloudClientId();
    expect(clientId).toBeDefined();
    expect(clientId.length).toBeGreaterThan(20);
    console.log(`✅ SoundCloud Client ID: ${clientId.substring(0, 8)}...`);
  }, TEST_TIMEOUT);

  test('Spotify - Get track by search', async () => {
    const track = await getTrack({
      source: 'spotify',
      artistName: 'Asake',
      trackTitle: 'Lonli',
      limit: 1,
    });
    
    expect(track).toBeDefined();
    expect(track?.title).toContain('Lonli');
    expect(track?.artist).toContain('Asake');
    expect(track?.duration).toBeGreaterThan(100);
    
    console.log(`✅ Spotify: ${track?.title} - ${track?.artist} (${track?.duration}s)`);
  }, TEST_TIMEOUT);

  test('Deezer - Get track by search', async () => {
    const track = await getTrack({
      source: 'deezer',
      artistName: 'Burna Boy',
      trackTitle: 'Last Last',
      limit: 1,
    });
    
    expect(track).toBeDefined();
    expect(track?.title).toContain('Last');
    expect(track?.artist).toContain('Burna');
    
    console.log(`✅ Deezer: ${track?.title} - ${track?.artist}`);
  }, TEST_TIMEOUT);

  test('SoundCloud - Get track by search', async () => {
    const track = await getTrack({
      source: 'soundcloud',
      artistName: 'Wizkid',
      trackTitle: 'Essence',
      limit: 1,
    });
    
    expect(track).toBeDefined();
    expect(track?.title).toBeDefined();
    
    console.log(`✅ SoundCloud: ${track?.title} - ${track?.artist}`);
  }, TEST_TIMEOUT);

  test('YouTube Music - Get track', async () => {
    const track = await getTrack({
      source: 'youtubeMusic',
      artistName: 'Rema',
      trackTitle: 'Calm Down',
      limit: 1,
    });
    
    expect(track).toBeDefined();
    expect(track?.title).toBeDefined();
    
    console.log(`✅ YouTube Music: ${track?.title} - ${track?.artist}`);
  }, TEST_TIMEOUT);

  test('Multi-source search - find track across sources', async () => {
    const result = await searchGet({
      query: 'Davido Unavailable',
      source: 'all',
      limit: 5,
    });
    
    expect(result.tracks.length).toBeGreaterThan(0);
    console.log(`✅ Found ${result.tracks.length} tracks across ${result.tracks.map(t => t.source).join(', ')}`);
    
    // Log first few results
    result.tracks.slice(0, 3).forEach((track, i) => {
      console.log(`   ${i+1}. [${track.source}] ${track.title} - ${track.artist}`);
    });
  }, TEST_TIMEOUT);

  test('Player search - fallback chain works', async () => {
    const result = await getPlayerSearch({
      trackData: {
        artist: 'CKay',
        title: 'Love Nwantiti',
      },
    });
    
    expect(result).toBeDefined();
    expect(result?.tracks.length).toBeGreaterThan(0);
    console.log(`✅ Player search found on: ${result?.source}`);
  }, TEST_TIMEOUT);

  test('Cache system - L1 memory cache', async () => {
    const start = Date.now();
    
    // First call - cache miss
    const track1 = await getTrack({
      source: 'deezer',
      artistName: 'Burna Boy',
      trackTitle: 'Last Last',
    });
    
    const firstCallTime = Date.now() - start;
    
    // Second call - should be cache hit
    const start2 = Date.now();
    const track2 = await getTrack({
      source: 'deezer',
      artistName: 'Burna Boy',
      trackTitle: 'Last Last',
    });
    const secondCallTime = Date.now() - start2;
    
    expect(secondCallTime).toBeLessThan(firstCallTime);
    console.log(`✅ Cache: First call ${firstCallTime}ms, Second call ${secondCallTime}ms`);
  }, TEST_TIMEOUT);
});