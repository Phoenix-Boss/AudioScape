// src/services/session/setup.ts
import CookieManager from '@preeternal/react-native-cookie-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export class SessionInitializer {
  private static initialized = false;
  
  static async initializeAllSessions() {
    if (this.initialized) return;
    
    console.log('\n🔐 Initializing sessions...');
    
    const sources = [
      { name: 'spotify', domain: 'accounts.spotify.com', url: 'https://open.spotify.com' },
      { name: 'soundcloud', domain: 'soundcloud.com', url: 'https://soundcloud.com' },
      { name: 'deezer', domain: 'deezer.com', url: 'https://deezer.com' }
    ];
    
    for (const source of sources) {
      await this.establishSession(source.name, source.domain, source.url);
    }
    
    this.initialized = true;
    console.log('✅ Sessions initialized\n');
  }
  
  private static async establishSession(name: string, domain: string, url: string) {
    try {
      console.log(`   🌍 Initializing ${name} session...`);
      
      // Check if we already have cookies
      const existingCookies = await CookieManager.get(url);
      if (Object.keys(existingCookies).length > 0) {
        console.log(`   ✅ ${name} already has ${Object.keys(existingCookies).length} cookies`);
        return;
      }
      
      // Set a basic session cookie
      await CookieManager.set(url, {
        name: `session_${name}`,
        value: `init_${Date.now()}`,
        domain: `.${domain}`,
        path: '/',
        expires: new Date(Date.now() + 30 * 86400000).toISOString(),
        secure: true,
        httpOnly: false
      });
      
      // Backup to AsyncStorage
      const cookies = await CookieManager.get(url);
      await AsyncStorage.setItem(`cookies_${name}`, JSON.stringify(cookies));
      
      console.log(`   ✅ ${name} session initialized`);
    } catch (error) {
      console.log(`   ❌ Failed to initialize ${name}:`, error);
    }
  }
}