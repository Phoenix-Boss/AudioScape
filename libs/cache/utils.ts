// src/cache/utils.ts

import { createHash } from 'crypto';
import { TrackMetadata, TrackIdentifier } from './types';

/**
 * Generate consistent cache key with type safety
 */
export function generateKey(type: string, value: string): string {
  const normalized = value.toLowerCase().trim().replace(/\s+/g, ' ');
  const hash = createHash('sha256').update(normalized).digest('hex').substring(0, 16);
  return `${type}:${hash}`;
}

/**
 * Search query to cache key
 */
export function searchKey(query: string): string {
  return generateKey('search', query);
}

/**
 * Track to cache key (by ISRC or title+artist)
 */
export function trackKey(track: TrackMetadata | TrackIdentifier): string {
  if (track.isrc) {
    return `track:isrc:${track.isrc}`;
  }
  if (track.title && track.artist) {
    return generateKey('track', `${track.title} ${track.artist}`);
  }
  if (track.id) {
    return `track:id:${track.id}`;
  }
  throw new Error('Cannot generate track key: insufficient data');
}

/**
 * Stream key for track
 */
export function streamKey(trackId: string): string {
  return `stream:${trackId}`;
}

/**
 * Artist key
 */
export function artistKey(artistName: string): string {
  return generateKey('artist', artistName);
}

/**
 * Related tracks key
 */
export function relatedKey(trackId: string): string {
  return `related:${trackId}`;
}

/**
 * Check if timestamp is expired
 */
export function isExpired(timestamp: number): boolean {
  return Date.now() > timestamp;
}

/**
 * Calculate expiry timestamp
 */
export function expiryTime(secondsFromNow: number): number {
  return Date.now() + (secondsFromNow * 1000);
}

/**
 * Normalize search query
 */
export function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Extract artist from query (improved version)
 */
export function extractArtistFromQuery(query: string): string | null {
  // Pattern: "Song by Artist"
  const byMatch = query.match(/(.+) by (.+)/i);
  if (byMatch) {
    return byMatch[2].trim();
  }
  
  // Pattern: "Artist - Song"
  const dashMatch = query.match(/(.+)\s*-\s*(.+)/);
  if (dashMatch) {
    return dashMatch[1].trim();
  }
  
  // Pattern: "Artist Song" - unreliable, return null
  return null;
}

/**
 * Extract song from query
 */
export function extractSongFromQuery(query: string): string | null {
  const byMatch = query.match(/(.+) by (.+)/i);
  if (byMatch) {
    return byMatch[1].trim();
  }
  
  const dashMatch = query.match(/(.+)\s*-\s*(.+)/);
  if (dashMatch) {
    return dashMatch[2].trim();
  }
  
  return query; // Assume whole query is song name
}

/**
 * Merge track data (update existing with new)
 */
export function mergeTrackData(existing: TrackMetadata, newData: Partial<TrackMetadata>): TrackMetadata {
  return {
    ...existing,
    ...newData,
    lastAccessed: new Date().toISOString(),
    accessCount: (existing.accessCount || 0) + 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sleep utility for testing
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format cache key for display
 */
export function formatCacheKey(key: string): string {
  return key.replace(/[:\/]/g, '_');
}

/**
 * Parse cache key to get type and identifier
 */
export function parseCacheKey(key: string): { type: string; identifier: string } {
  const parts = key.split(':');
  return {
    type: parts[0],
    identifier: parts.slice(1).join(':'),
  };
}