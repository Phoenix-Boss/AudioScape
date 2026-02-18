// libs/cache/index.ts

import { cacheManager } from './cache-manager';
import { backgroundJobs } from './background-jobs';
import { deviceCache } from './device-cache';
import { supabaseCache } from './supabase-cache';
import { getConfig } from './config'; 
import * as utils from './utils';
import * as types from './types';

/**
 * Initialize cache system
 */
export function initCache(options: { startBackgroundJobs?: boolean } = {}): void {
  console.log('🚀 Initializing Mavin Cache System...');
  
  // ✅ Get config at runtime
  const config = getConfig();
  
  console.log(`   Device cache: ${config.device.enabled ? 'ON' : 'OFF'}`);
  console.log(`   Supabase cache: ${config.supabase?.enabled ? 'ON' : 'OFF'}`);
  
  if (options.startBackgroundJobs) {
    backgroundJobs.start();
  }
}

/**
 * Shutdown cache system
 */
export async function shutdownCache(): Promise<void> {
  console.log('Shutting down cache system...');
  backgroundJobs.stop();
}

// Export everything with proper types
export {
  cacheManager as cache,
  backgroundJobs,
  deviceCache,
  supabaseCache,
  utils,
  types
};

// Default export
export default {
  cache: cacheManager,
  backgroundJobs,
  deviceCache,
  supabaseCache,
  initCache,
  shutdownCache,
  utils,
  types
};