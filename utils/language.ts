// src/utils/language.ts
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh',
  'ar', 'hi', 'bn', 'pa', 'jv', 'te', 'mr', 'ta', 'ur', 'gu',
  'kn', 'ml', 'or', 'as', 'mai', 'sat', 'ks', 'sd', 'ne', 'si',
  'th', 'lo', 'my', 'km', 'vi', 'id', 'tl', 'ms', 'sw', 'zu',
  'xh', 'st', 'tn', 'ts', 'ss', 've', 'nr', 'af', 'am', 'om',
];

export const getDeviceLanguage = (): string => {
  const locale =
    Platform.OS === 'ios'
      ? NativeModules.SettingsManager?.settings?.AppleLocale ||
        NativeModules.SettingsManager?.settings?.AppleLanguages[0]
      : NativeModules.I18nManager?.localeIdentifier;

  if (!locale) return 'en';

  const languageCode = locale.split('_')[0].split('-')[0].toLowerCase();
  return SUPPORTED_LANGUAGES.includes(languageCode) ? languageCode : 'en';
};

export const getLanguage = async (): Promise<string> => {
  try {
    const stored = await AsyncStorage.getItem('language');
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      return stored;
    }

    const deviceLang = getDeviceLanguage();
    await AsyncStorage.setItem('language', deviceLang);
    return deviceLang;
  } catch {
    return 'en';
  }
};

export const setLanguage = async (language: string): Promise<void> => {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }
  await AsyncStorage.setItem('language', language);
};

export const getLanguageName = (code: string): string => {
  const names: Record<string, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    pt: 'Português',
    ru: 'Русский',
    ja: '日本語',
    ko: '한국어',
    zh: '中文',
    ar: 'العربية',
    hi: 'हिन्दी',
    bn: 'বাংলা',
    pa: 'ਪੰਜਾਬੀ',
    te: 'తెలుగు',
    mr: 'मराठी',
    ta: 'தமிழ்',
    ur: 'اردو',
  };
  return names[code] || code;
};

export const getLanguageDirection = (language: string): 'ltr' | 'rtl' => {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi'];
  return rtlLanguages.includes(language) ? 'rtl' : 'ltr';
};