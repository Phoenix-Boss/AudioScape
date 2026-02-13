import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

class SecureStorageManager {
  private readonly PREFIX = 'mavin_';

  /**
   * Save a value securely
   */
  async setItem(key: string, value: any): Promise<void> {
    try {
      const stringValue = typeof value === 'string' 
        ? value 
        : JSON.stringify(value);
      
      await SecureStore.setItemAsync(this.getKey(key), stringValue, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      });
      
      if (__DEV__) {
        console.log(`[SecureStore] Saved: ${key}`);
      }
    } catch (error) {
      console.error(`[SecureStore] Failed to save ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get a value
   */
  async getItem<T = any>(key: string): Promise<T | null> {
    try {
      const value = await SecureStore.getItemAsync(this.getKey(key));
      
      if (!value) return null;
      
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    } catch (error) {
      console.error(`[SecureStore] Failed to get ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove a value
   */
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.getKey(key));
    } catch (error) {
      console.error(`[SecureStore] Failed to remove ${key}:`, error);
    }
  }

  private getKey(key: string): string {
    return `${this.PREFIX}${key}`;
  }
}

export const SecureStorage = new SecureStorageManager();