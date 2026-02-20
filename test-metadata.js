// test-metadata.js
// Run with: node test-metadata.js

const SUPABASE_URL = 'https://iyubwmkgvuoypgbrygvx.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dWJ3bWtndnVveXBnYnJ5Z3Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MDQzMjAsImV4cCI6MjA4NjA4MDMyMH0.GS_X6gHAxkfVTCF-I6AJLs70o6SAM8El30LMyZUilWQ';

// Real tracks to test
const testTracks = [
    { query: "Asake Lonli", expected: "Lonli" },
    { query: "Burna Boy Last Last", expected: "Last Last" },
    { query: "Wizkid Essence", expected: "Essence" },
    { query: "Davido Unavailable", expected: "Unavailable" },
    { query: "Rema Calm Down", expected: "Calm Down" },
    { query: "CKay Love Nwantiti", expected: "Love Nwantiti" }
];

async function testMetadataSource() {
    console.log('\n🎵 TESTING REAL METADATA SOURCE');
    console.log('================================\n');
    
    let successCount = 0;
    
    for (const test of testTracks) {
        try {
            console.log(`🔍 Searching: "${test.query}"`);
            
            const response = await fetch(`${SUPABASE_URL}/functions/v1/metadata-source`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': ANON_KEY,
                    'Authorization': `Bearer ${ANON_KEY}`
                },
                body: JSON.stringify({ query: test.query })
            });
            
            const data = await response.json();
            
            if (data.success) {
                successCount++;
                console.log(`✅ SUCCESS from ${data.source.toUpperCase()}`);
                console.log(`   └─ Title: ${data.data.track.title}`);
                console.log(`   └─ Artist: ${data.data.track.artist}`);
                console.log(`   └─ Album: ${data.data.track.album}`);
                console.log(`   └─ ISRC: ${data.data.track.isrc || 'N/A'}`);
                console.log(`   └─ Duration: ${data.data.track.duration}s`);
                console.log(`   └─ Response: ${data.responseTime}ms`);
                
                // Verify it matches expected
                if (data.data.track.title.includes(test.expected)) {
                    console.log(`   ✅ Match: "${test.expected}" found`);
                } else {
                    console.log(`   ⚠️  Expected "${test.expected}" but got "${data.data.track.title}"`);
                }
            } else {
                console.log(`❌ FAILED: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.log(`❌ ERROR: ${error.message}`);
        }
        console.log(''); // Empty line
    }
    
    console.log('================================');
    console.log(`📊 RESULTS: ${successCount}/${testTracks.length} successful`);
    console.log('================================');
}

// Run the test
testMetadataSource();