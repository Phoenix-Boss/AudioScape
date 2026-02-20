// src/services/api/request/delete.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface ApiDeleteParams {
  url: string;
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

export default async function deleteRequest<T = any>({
  url,
  params = {},
  isWithSelfId = false,
  isWithSelfToken = false,
  isWithSelfLanguage = false,
  onSuccess,
  onError,
  onComplete,
}: ApiDeleteParams): Promise<T | undefined> {
  const startTime = Date.now();

  try {
    const [profileId, token, language] = await Promise.all([
      AsyncStorage.getItem('profile_id'),
      AsyncStorage.getItem('token'),
      AsyncStorage.getItem('language'),
    ]);

    const paramsData: Record<string, any> = {
      ...params,
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
      Accept: 'application/json',
      'Accept-Language': language || 'en-US',
    };

    if (url.includes('spotify.com') && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config: AxiosRequestConfig = {
      url,
      method: 'DELETE',
      params: paramsData,
      headers,
      timeout: 10000,
    };

    const response = await axios.request(config);
    const responseTime = Date.now() - startTime;

    console.log(`✅ DELETE ${url} (${responseTime}ms)`);

    if (onSuccess) {
      return await onSuccess(response);
    }

    return response.data;
  } catch (error) {
    console.error(`❌ DELETE ${url} failed:`, error);

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