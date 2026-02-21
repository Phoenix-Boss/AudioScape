// src/services/api/request/get.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@preeternal/react-native-cookie-manager'; // Changed import
import DeviceInfo from 'react-native-device-info';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import packageJson from '../../../package.json';

export interface ApiRequestParams {
  url: string;
  params?: Record<string, any>;
  isWithSelfId?: boolean;
  isWithSelfToken?: boolean;
  isWithSelfLanguage?: boolean;
  page?: number;
  limit?: number;
  order?: string;
  onSuccess?: (response: AxiosResponse) => Promise<any> | any;
  onError?: (error: any) => Promise<void> | void;
  onComplete?: () => Promise<void> | void;
}

const APP_VERSION = packageJson.version || '1.0.0';
const GUEST_TOKEN = 'guest';

const snakeCase = (str: string): string => {
  return str?.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

export default async function getRequest<T = any>({
  url,
  params = {},
  isWithSelfId = false,
  isWithSelfToken = false,
  isWithSelfLanguage = false,
  page,
  limit,
  order,
  onSuccess,
  onError,
  onComplete,
}: ApiRequestParams): Promise<T | undefined> {
  const startTime = Date.now();

  try {
    // ============================================
    // 1. Get ALL device context in parallel
    // ============================================
    const [
      profileId, 
      token, 
      language, 
      soundCloudClientId,
      deviceId,
      userAgent,
      netInfo,
      systemName,
      systemVersion,
      model,
      brand
    ] = await Promise.allSettled([ // Use allSettled to prevent one failure from breaking everything
      AsyncStorage.getItem('profile_id'),
      AsyncStorage.getItem('token'),
      AsyncStorage.getItem('language'),
      AsyncStorage.getItem('soundcloud_client_id'),
      DeviceInfo.getUniqueId().catch(() => 'unknown-device-id'),
      DeviceInfo.getUserAgent().catch(() => Platform.select({
        ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        android: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36',
        default: 'Mozilla/5.0 (Unknown)'
      })),
      NetInfo.fetch().catch(() => ({ type: 'unknown', isConnected: true, isInternetReachable: true, isConnectionExpensive: false })),
      DeviceInfo.getSystemName().catch(() => Platform.OS),
      DeviceInfo.getSystemVersion().catch(() => Platform.Version?.toString() || '1.0'),
      DeviceInfo.getModel().catch(() => 'Unknown'),
      DeviceInfo.getBrand().catch(() => 'Unknown')
    ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

    // ============================================
    // 2. Extract domain for cookies
    // ============================================
    let domain = '';
    try {
      domain = new URL(url).hostname;
    } catch (e) {
      console.warn('Invalid URL:', url);
    }

    // ============================================
    // 3. Get REAL cookies for this domain
    // ============================================
    let cookies: Record<string, any> = {};
    let cookieString = '';
    
    if (domain) {
      try {
        // For iOS, we might need to use both stores (native and WebKit)
        const [nativeCookies, webKitCookies] = await Promise.allSettled([
          CookieManager.get(domain, false), // Native store (NSHTTPCookieStorage)
          Platform.OS === 'ios' ? CookieManager.get(domain, true) : Promise.resolve({}) // WebKit store (WKHTTPCookieStore)
        ]);
        
        // Merge cookies from both stores
        cookies = {
          ...(nativeCookies.status === 'fulfilled' ? nativeCookies.value : {}),
          ...(webKitCookies.status === 'fulfilled' ? webKitCookies.value : {})
        };
        
        cookieString = Object.values(cookies)
          .map(cookie => `${cookie.name}=${cookie.value}`)
          .join('; ');
          
        console.log(`   🍪 Found ${Object.keys(cookies).length} cookies for ${domain}`);
      } catch (e) {
        console.warn('Failed to get cookies:', e);
      }
    }

    // ============================================
    // 4. Build params with all context
    // ============================================
    const paramsData: Record<string, any> = {
      ...params,
      ...(isWithSelfId && profileId && { profile_id: profileId }),
      ...(isWithSelfToken && {
        token: token || GUEST_TOKEN,
      }),
      ...(isWithSelfLanguage && language && { language }),
      ...(page && { page }),
      ...(limit && { limit }),
      ...(order && { order: snakeCase(order) }),
      version: APP_VERSION,
    };

    // ============================================
    // 5. Handle source-specific modifications
    // ============================================
    let finalUrl = url;
    let finalParams = paramsData;

    if (url.includes('soundcloud.com') && !url.includes('client_id') && soundCloudClientId) {
      finalParams = { ...finalParams, client_id: soundCloudClientId };
    }

    if (url.includes('youtube.com/youtubei')) {
      finalParams = {
        ...finalParams,
        key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
      };
    }

    // ============================================
    // 6. Build REAL device headers
    // ============================================
    const headers: Record<string, string> = {
      // REAL User Agent from device
      'User-Agent': userAgent || '',
      
      // Device identification
      ...(deviceId && { 'X-Device-ID': deviceId }),
      ...(model && { 'X-Device-Model': model }),
      ...(brand && { 'X-Device-Brand': brand }),
      ...(systemName && systemVersion && { 'X-OS': `${systemName} ${systemVersion}` }),
      
      // Network context
      ...(netInfo?.type && { 'X-Network-Type': netInfo.type }),
      ...(netInfo?.carrier && { 'X-Network-Carrier': netInfo.carrier }),
      'X-Connection-Expensive': String(netInfo?.isConnectionExpensive || false),
      
      // Standard headers
      'Accept': 'application/json',
      'Accept-Language': language || 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      
      // App context
      'X-App-Version': APP_VERSION,
      'X-App-Platform': Platform.OS,
      
      // Cookies if available
      ...(cookieString && { 'Cookie': cookieString }),
    };

    // ============================================
    // 7. Add authentication if available
    // ============================================
    if (url.includes('spotify.com') && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // ============================================
    // 8. Log request details for debugging
    // ============================================
    console.log(`\n🌐 REQUEST to ${domain}:`);
    console.log(`   Method: GET`);
    console.log(`   Path: ${finalUrl.split('?')[0]}`);
    console.log(`   Cookies: ${Object.keys(cookies).length} present`);
    console.log(`   Device: ${model || 'Unknown'} (${systemName || 'OS'} ${systemVersion || ''})`);
    console.log(`   Network: ${netInfo?.type || 'unknown'}${netInfo?.carrier ? ` via ${netInfo.carrier}` : ''}`);

    // ============================================
    // 9. Make the request with Axios
    // ============================================
    const config: AxiosRequestConfig = {
      url: finalUrl,
      method: 'GET',
      params: finalParams,
      headers,
      timeout: 15000,
      validateStatus: (status) => status < 500,
      withCredentials: true, // Important for cookies!
      maxRedirects: 5,
    };

    const response = await axios.request(config);
    const responseTime = Date.now() - startTime;

    // ============================================
    // 10. Save any new cookies from response
    // ============================================
    if (domain && response.headers['set-cookie']) {
      try {
        const setCookieHeader = response.headers['set-cookie'];
        if (Array.isArray(setCookieHeader)) {
          for (const cookieStr of setCookieHeader) {
            await CookieManager.setFromResponse(domain, cookieStr);
          }
        } else if (typeof setCookieHeader === 'string') {
          await CookieManager.setFromResponse(domain, setCookieHeader);
        }
        console.log(`   🍪 Saved ${Array.isArray(setCookieHeader) ? setCookieHeader.length : 1} new cookies`);
      } catch (e) {
        console.warn('Failed to save cookies:', e);
      }
    }

    console.log(`✅ Response (${responseTime}ms): ${response.status}`);

    // ============================================
    // 11. Handle success callback
    // ============================================
    if (onSuccess) {
      return await onSuccess(response);
    }

    return response.data;
    
  } catch (error: any) {
    console.error(`❌ Request failed after ${Date.now() - startTime}ms:`, error?.message || error);

    if (onError) {
      await onError(error);
    } else {
      throw error;
    }
  } finally {
    if (onComplete) {
      await onComplete();
    }
  }
}