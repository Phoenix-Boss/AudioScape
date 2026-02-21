// tests/setup.ts - MINIMAL for API testing only

// Load environment variables
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

// ============================================
// MOCKS ARE NOW IN __mocks__ FOLDER!
// Jest automatically picks them up
// No need to mock here anymore
// ============================================

// Increase timeout for real API calls
jest.setTimeout(30000);

// Simple test data
global.testTracks = [
  { artist: 'Asake', title: 'Lonli', source: 'spotify' },
  { artist: 'Burna Boy', title: 'Last Last', source: 'deezer' },
  { artist: 'Wizkid', title: 'Essence', source: 'soundcloud' },
];

declare global {
  var testTracks: Array<{ artist: string; title: string; source: string }>;
}

export {};