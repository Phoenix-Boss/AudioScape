// src/test-runner.ts
import { getSoundCloudClientId } from './utils/soundcloud';
import getTrack from './services/api/track/get';
import getPlayerSearch from './services/api/player/search/get';
import searchGet from './services/api/search/get';
import { CacheFortress } from './services/cache/fortress';

async function runTests() {
  console.log('\n🎵 STEP 3 TEST SUITE');
  console.log('====================\n');

  // Test 1: SoundCloud Client ID
  console.log('📡 Test 1: SoundCloud Client ID');
  try {
    const clientId = await getSoundCloudClientId();
    console.log(`   ✅ Client ID: ${clientId.substring(0, 8)}...`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // Test 2: Spotify Search
  console.log('\n📡 Test 2: Spotify Search');
  try {
    const track = await getTrack({
      source: 'spotify',
      artistName: 'Asake',
      trackTitle: 'Lonli',
    });
    console.log(`   ✅ Found: ${track?.title} - ${track?.artist}`);
    console.log(`      Duration: ${track?.duration}s`);
    console.log(`      Album: ${track?.album}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // Test 3: Deezer Search
  console.log('\n📡 Test 3: Deezer Search');
  try {
    const track = await getTrack({
      source: 'deezer',
      artistName: 'Burna Boy',
      trackTitle: 'Last Last',
    });
    console.log(`   ✅ Found: ${track?.title} - ${track?.artist}`);
    console.log(`      ISRC: ${track?.isrc || 'N/A'}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // Test 4: SoundCloud Search
  console.log('\n📡 Test 4: SoundCloud Search');
  try {
    const track = await getTrack({
      source: 'soundcloud',
      artistName: 'Wizkid',
      trackTitle: 'Essence',
    });
    console.log(`   ✅ Found: ${track?.title} - ${track?.artist}`);
    console.log(`      Image: ${track?.image?.substring(0, 50)}...`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // Test 5: YouTube Music Search
  console.log('\n📡 Test 5: YouTube Music Search');
  try {
    const track = await getTrack({
      source: 'youtubeMusic',
      artistName: 'Rema',
      trackTitle: 'Calm Down',
    });
    console.log(`   ✅ Found: ${track?.title} - ${track?.artist}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // Test 6: Multi-Source Search
  console.log('\n📡 Test 6: Multi-Source Search');
  try {
    const results = await searchGet({
      query: 'Davido Unavailable',
      source: 'all',
      limit: 5,
    });
    console.log(`   ✅ Found ${results.tracks.length} tracks:`);
    results.tracks.slice(0, 3).forEach((track, i) => {
      console.log(`      ${i+1}. [${track.source}] ${track.title} - ${track.artist}`);
    });
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // Test 7: Player Search with Fallback
  console.log('\n📡 Test 7: Player Search Fallback');
  try {
    const result = await getPlayerSearch({
      trackData: {
        artist: 'CKay',
        title: 'Love Nwantiti',
      },
    });
    console.log(`   ✅ Found on: ${result?.source}`);
    console.log(`      Track: ${result?.tracks[0]?.title} - ${result?.tracks[0]?.artist}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // Test 8: Cache Performance
  console.log('\n📡 Test 8: Cache Performance');
  try {
    const start1 = Date.now();
    await getTrack({
      source: 'deezer',
      artistName: 'Burna Boy',
      trackTitle: 'Last Last',
    });
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    await getTrack({
      source: 'deezer',
      artistName: 'Burna Boy',
      trackTitle: 'Last Last',
    });
    const time2 = Date.now() - start2;

    console.log(`   First call: ${time1}ms`);
    console.log(`   Second call: ${time2}ms`);
    console.log(`   Cache speedup: ${Math.round((time1 - time2) / time1 * 100)}% faster`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  console.log('\n🏁 TESTS COMPLETE');
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };