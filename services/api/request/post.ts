// src/services/api/request/post.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface ApiPostParams {
  url: string;
  data?: Record<string, any>;
  params?: Record<string, any>;
  isWithSelfId?: boolean;
  isWithSelfToken?: boolean;
  isWithSelfLanguage?: boolean;
  onSuccess?: (response: AxiosResponse) => Promise<any> | any;
  onError?: (error: any) => Promise<void> | void;
  onComplete?: () => Promise<void> | void;
}

const APP_VERSION = '1.0.0';
const GUEST_TOKEN = 'guest';

export default async function postRequest<T = any>({
  url,
  data = {},
  params = {},
  isWithSelfId = false,
  isWithSelfToken = false,
  isWithSelfLanguage = false,
  onSuccess,
  onError,
  onComplete,
}: ApiPostParams): Promise<T | undefined> {
  const startTime = Date.now();

  try {
    const [profileId, token, language] = await Promise.all([
      AsyncStorage.getItem('profile_id'),
      AsyncStorage.getItem('token'),
      AsyncStorage.getItem('language'),
    ]);

    const requestData: Record<string, any> = {
      ...data,
      ...(isWithSelfId && profileId && { profile_id: profileId }),
      ...(isWithSelfToken && {
        token: token || GUEST_TOKEN,
      }),
      ...(isWithSelfLanguage && language && { language }),
      version: APP_VERSION,
    };

    const headers: Record<string, string> = {
      'User-Agent': Platform.select({
        ios: `Mavin/${APP_VERSION} (iPhone; iOS ${Platform.Version})`,
        android: `Mavin/${APP_VERSION} (Linux; Android ${Platform.Version})`,
        default: `Mavin/${APP_VERSION}`,
      }),
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Language': language || 'en-US',
    };

    if (url.includes('spotify.com') && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: AxiosRequestConfig = {
      url,
      method: 'POST',
      data: requestData,
      params,
      headers,
      timeout: 10000,
    };

    const response = await axios.request(config);
    const responseTime = Date.now() - startTime;

    console.log(`✅ POST ${url} (${responseTime}ms)`);

    if (onSuccess) {
      return await onSuccess(response);
    }

    return response.data;
  } catch (error) {
    console.error(`❌ POST ${url} failed:`, error);

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