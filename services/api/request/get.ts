// src/services/api/request/get.ts
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import packageJson from '../../../../package.json';

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
    const [profileId, token, language, soundCloudClientId] = await Promise.all([
      AsyncStorage.getItem('profile_id'),
      AsyncStorage.getItem('token'),
      AsyncStorage.getItem('language'),
      AsyncStorage.getItem('soundcloud_client_id'),
    ]);

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
      url: finalUrl,
      method: 'GET',
      params: finalParams,
      headers,
      timeout: 10000,
      validateStatus: (status) => status < 500,
    };

    const response = await axios.request(config);
    const responseTime = Date.now() - startTime;

    console.log(`✅ GET ${finalUrl} (${responseTime}ms)`);

    if (onSuccess) {
      return await onSuccess(response);
    }

    return response.data;
  } catch (error) {
    console.error(`❌ GET ${url} failed:`, error);

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