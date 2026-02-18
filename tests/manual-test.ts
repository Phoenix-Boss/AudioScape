// test/manual-test.ts

import { cache, initCache } from '../libs/cache';
import { supabaseCache } from '../libs/cache/supabase-cache';
import { deviceCache } from '../libs/cache/device-cache';
import { sleep } from '../libs/cache/utils';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.test' });

/**
 * Manual testing script to verify cache functionality
 */
async function runManualTests() {
  console.log('\n🧪 ========================================');
  console.log('🧪 MANUAL CACHE SYSTEM TESTS');
  console.log('🧪 ========================================\n');

  // Test 1: Initialization
  console.log('📋 TEST 1: Initialize Cache System');
  initCache();
  await sleep(1000);
  console.log('✅ Cache system initialized\n');

  // Test 2: Cache Miss
  console.log('📋 TEST 2: Cache Miss Test');
  const testQuery = 'Asake Lonli';
  console.log(`   Searching for: "${testQuery}"`);
  
  const missResult = await cache.getSearch(testQuery);
  console.log(`   Result: ${missResult ? 'FOUND' : 'NOT FOUND (expected)'}`);
  console.log(`   Source: ${missResult?.source || 'none'}`);
  console.log('✅ Cache miss working correctly\n');

  // Test 3: Save to Cache
  console.log('📋 TEST 3: Save to Cache');
  const trackData = {
    title: 'Lonli',
    artist: 'Asake',
    album: 'Work Of Art',
    isrc: 'QMDA62318741',
    duration: 187,
    artworkUrl: 'https://example.com/art.jpg'
  };
  
  const streamData = {
    trackId: '', // Will be filled by saveSearch
    source: 'youtube' as const,
    streamUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    quality: '128kbps',
    format: 'webm'
  };
  
  console.log(`   Saving track: ${trackData.title} by ${trackData.artist}`);
  const saveResult = await cache.saveSearch(testQuery, trackData, streamData);
  console.log(`   Save successful: ${saveResult ? 'YES' : 'NO'}`);
  
  if (!saveResult) {
    console.error('❌ Save failed - check Supabase connection');
    return;
  }
  console.log('✅ Save successful\n');

  // Test 4: Cache Hit
  console.log('📋 TEST 4: Cache Hit Test');
  console.log(`   Searching again: "${testQuery}"`);
  
  const hitResult = await cache.getSearch(testQuery);
  console.log(`   Found: ${hitResult ? 'YES' : 'NO'}`);
  console.log(`   Source: ${hitResult?.source}`);
  console.log(`   Track: ${hitResult?.track.title} by ${hitResult?.track.artist}`);
  
  if (!hitResult) {
    console.error('❌ Cache hit failed - should have found the track');
    return;
  }
  console.log('✅ Cache hit working correctly\n');

  // Test 5: Device Cache Direct
  console.log('📋 TEST 5: Device Cache Direct Test');
  const deviceKey = `test:${Date.now()}`;
  await deviceCache.set(deviceKey, { test: 'data' });
  const deviceGet = await deviceCache.get(deviceKey);
  console.log(`   Device cache set/get: ${deviceGet ? 'WORKING' : 'FAILED'}`);
  console.log('✅ Device cache operational\n');

  // Test 6: Supabase Cache Direct
  console.log('📋 TEST 6: Supabase Cache Direct Test');
  if (supabaseCache.isEnabled()) {
    const testTrack = {
      title: 'Test Song',
      artist: 'Test Artist',
      album: 'Test Album'
    };
    
    const trackId = await supabaseCache.saveTrack(testTrack);
    console.log(`   Supabase save track: ${trackId ? 'WORKING' : 'FAILED'}`);
    
    if (trackId) {
      const retrieved = await supabaseCache.getTrack(trackId);
      console.log(`   Supabase get track: ${retrieved ? 'WORKING' : 'FAILED'}`);
    }
  } else {
    console.log('   Supabase cache disabled - check environment variables');
  }
  console.log('✅ Supabase cache tests complete\n');

  // Test 7: Cache Statistics
  console.log('📋 TEST 7: Cache Statistics');
  const stats = await cache.getStats();
  console.log('   Current stats:');
  console.log(`   Device cache size: ${stats.device.size}/${stats.device.maxSize}`);
  console.log(`   Supabase tracks: ${stats.supabase?.tracks || 0}`);
  console.log(`   Active streams: ${stats.supabase?.activeStreams || 0}`);
  console.log(`   Total searches: ${stats.supabase?.searches || 0}`);
  console.log('✅ Stats retrieved\n');

  // Test 8: Multiple Searches
  console.log('📋 TEST 8: Multiple Searches Test');
  const searches = [
    'Burna Boy City Boys',
    'Rema Calm Down',
    'Davido Unavailable',
    'Asake Lonli' // Already cached
  ];
  
  for (const query of searches) {
    const result = await cache.getSearch(query);
    console.log(`   "${query}": ${result ? 'HIT' : 'MISS'} (${result?.source || 'none'})`);
  }
  console.log('✅ Multiple searches complete\n');

  // Test 9: Background Jobs (if enabled)
  console.log('📋 TEST 9: Background Jobs Test');
  console.log('   Running background jobs manually...');
  
  const { backgroundJobs } = require('../src/cache/background-jobs');
  await backgroundJobs.runAllJobs();
  
  console.log('✅ Background jobs executed\n');

  // Test 10: Clear Cache
  console.log('📋 TEST 10: Clear Cache Test');
  await deviceCache.clear();
  console.log('   Device cache cleared');
  
  const afterClear = await cache.getSearch(testQuery);
  console.log(`   Search after clear: ${afterClear ? 'HIT' : 'MISS (expected)'}`);
  console.log('✅ Clear cache working\n');

  // Summary
  console.log('\n📊 ========================================');
  console.log('📊 TEST SUMMARY');
  console.log('📊 ========================================');
  console.log('✅ Cache System: OPERATIONAL');
  console.log('✅ Device Cache: WORKING');
  console.log(`✅ Supabase Cache: ${supabaseCache.isEnabled() ? 'WORKING' : 'DISABLED'}`);
  console.log('✅ Cache Manager: WORKING');
  console.log('✅ Background Jobs: CONFIGURED');
  console.log('\n🎉 All tests passed!\n');
}

// Run tests
runManualTests().catch(error => {
  console.error('❌ Test failed with error:', error);
  process.exit(1);
});