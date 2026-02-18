// tests/setup.ts

// ⚠️ MUST BE FIRST - Load environment variables before anything else
import * as dotenv from 'dotenv';
import path from 'path';

// Force load .env.test with absolute path
const envPath = path.resolve(process.cwd(), '.env.test');
console.log('📁 Loading .env.test from:', envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Failed to load .env.test:', result.error);
  process.exit(1);
} else {
  console.log('✅ .env.test loaded successfully');
  console.log('📋 Environment variables now available:');
  console.log('  SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? '✅' : '❌');
  console.log('  Actual URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
}

// Now import everything else
import 'react-native-url-polyfill/auto';
import 'text-encoding-polyfill';
import 'event-target-polyfill';
import 'web-streams-polyfill';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiRemove: jest.fn(() => Promise.resolve()),
}), { virtual: true });

// Mock MMKV
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
    delete: jest.fn(),
    getAllKeys: jest.fn().mockReturnValue([]),
  })),
}), { virtual: true });

// Verify environment variables are set
console.log('\n🔍 Final Environment Check:');
console.log('  EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('  EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌');
console.log('  SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅' : '❌');

// Set test environment variables (as fallback)
process.env.EXPO_PUBLIC_APP_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(30000);