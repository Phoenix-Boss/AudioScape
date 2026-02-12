// src/services/mavin/monetization/GracePeriodManager.ts

import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import Crypto from 'expo-crypto';

// Types
export interface GracePeriodStatus {
  isActive: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  installTimestamp: number;
  gracePeriodEnd: number;
  isPremium: boolean;
  premiumExpiry?: number;
  deviceFingerprint: string;
}

export interface PremiumUser {
  id: string;
  device_fingerprint: string;
  is_active: boolean;
  subscription_tier: 'free' | 'pro' | 'premium';
  trial_ends_at: number | null;
  subscription_ends_at: number | null;
  card_token?: string;
  created_at: number;
}

// Constants
const GRACE_PERIOD_DAYS = 7;
const STORAGE_KEYS = {
  INSTALL_TIMESTAMP: '@mavin/install_timestamp',
  DEVICE_FINGERPRINT: '@mavin/device_fingerprint',
  GRACE_PERIOD_END: '@mavin/grace_period_end',
  PREMIUM_STATUS: '@mavin/premium_status',
} as const;

// Supabase client (configure with your existing setup)
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * GracePeriodManager - Core implementation of 7-day ad-free grace period
 */
class GracePeriodManager {
  private static instance: GracePeriodManager;
  
  private constructor() {}

  static getInstance(): GracePeriodManager {
    if (!GracePeriodManager.instance) {
      GracePeriodManager.instance = new GracePeriodManager();
    }
    return GracePeriodManager.instance;
  }

  /**
   * Generate unique device fingerprint (SHA-256 of device model + install timestamp)
   * Anonymous, no PII collected
   */
  async generateDeviceFingerprint(): Promise<string> {
    try {
      // Check if already exists
      const existingFingerprint = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_FINGERPRINT);
      if (existingFingerprint) {
        return existingFingerprint;
      }

      // Generate fingerprint components
      const deviceModel = Device.modelName || 'unknown';
      const deviceBrand = Device.brand || 'unknown';
      const deviceYear = Device.deviceYearClass || 2024;
      const installTimestamp = await this.getInstallTimestamp();
      
      // Combine for hash input
      const fingerprintInput = `${deviceModel}:${deviceBrand}:${deviceYear}:${installTimestamp}`;
      
      // Generate SHA-256 hash
      const fingerprint = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        fingerprintInput
      );

      // Store for future use
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_FINGERPRINT, fingerprint);
      
      return fingerprint;
    } catch (error) {
      console.error('Failed to generate device fingerprint:', error);
      // Fallback to simpler fingerprint
      const fallbackFingerprint = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_FINGERPRINT, fallbackFingerprint);
      return fallbackFingerprint;
    }
  }

  /**
   * Get or create install timestamp (first app launch)
   */
  async getInstallTimestamp(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.INSTALL_TIMESTAMP);
      
      if (stored) {
        return parseInt(stored, 10);
      }
      
      // First launch - set timestamp
      const now = Date.now();
      await AsyncStorage.setItem(STORAGE_KEYS.INSTALL_TIMESTAMP, now.toString());
      
      // Also set grace period end
      const gracePeriodEnd = now + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      await AsyncStorage.setItem(STORAGE_KEYS.GRACE_PERIOD_END, gracePeriodEnd.toString());
      
      return now;
    } catch (error) {
      console.error('Failed to get install timestamp:', error);
      return Date.now(); // Fallback to current time
    }
  }

  /**
   * Calculate grace period end time
   */
  async getGracePeriodEnd(): Promise<number> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.GRACE_PERIOD_END);
      
      if (stored) {
        return parseInt(stored, 10);
      }
      
      // Calculate based on install timestamp
      const installTimestamp = await this.getInstallTimestamp();
      const gracePeriodEnd = installTimestamp + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      
      await AsyncStorage.setItem(STORAGE_KEYS.GRACE_PERIOD_END, gracePeriodEnd.toString());
      return gracePeriodEnd;
    } catch (error) {
      console.error('Failed to get grace period end:', error);
      return Date.now() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000); // Default 7 days from now
    }
  }

  /**
   * Check if grace period is currently active
   */
  async isGracePeriodActive(): Promise<boolean> {
    try {
      // First check if user is premium (overrides grace period)
      const isPremium = await this.isPremiumUser();
      if (isPremium) {
        return true; // Premium users effectively have permanent grace period
      }

      const gracePeriodEnd = await this.getGracePeriodEnd();
      const now = Date.now();
      
      return now < gracePeriodEnd;
    } catch (error) {
      console.error('Failed to check grace period:', error);
      return true; // Fail open - assume grace period active
    }
  }

  /**
   * Calculate remaining grace period time
   */
  async getRemainingGracePeriod(): Promise<{ days: number; hours: number; minutes: number }> {
    try {
      const gracePeriodEnd = await this.getGracePeriodEnd();
      const now = Date.now();
      const remainingMs = Math.max(0, gracePeriodEnd - now);
      
      const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      
      return { days, hours, minutes };
    } catch (error) {
      console.error('Failed to calculate remaining grace period:', error);
      return { days: 0, hours: 0, minutes: 0 };
    }
  }

  /**
   * Check premium status via Supabase RPC
   */
  async isPremiumUser(): Promise<boolean> {
    try {
      // Check local cache first
      const cachedStatus = await AsyncStorage.getItem(STORAGE_KEYS.PREMIUM_STATUS);
      if (cachedStatus === 'true') {
        return true;
      }
      
      const deviceFingerprint = await this.generateDeviceFingerprint();
      
      // Call Supabase RPC function (needs to be created in your database)
      const { data, error } = await supabase
        .rpc('check_premium_status', {
          p_device_fingerprint: deviceFingerprint
        });
      
      if (error) {
        console.error('Supabase RPC error:', error);
        return false;
      }
      
      const isPremium = data?.is_active === true;
      
      // Cache the result (5 minute TTL)
      await AsyncStorage.setItem(STORAGE_KEYS.PREMIUM_STATUS, isPremium.toString());
      setTimeout(() => {
        AsyncStorage.removeItem(STORAGE_KEYS.PREMIUM_STATUS);
      }, 5 * 60 * 1000);
      
      return isPremium;
    } catch (error) {
      console.error('Failed to check premium status:', error);
      return false;
    }
  }

  /**
   * Get complete grace period status
   */
  async getGracePeriodStatus(): Promise<GracePeriodStatus> {
    try {
      const [
        deviceFingerprint,
        installTimestamp,
        gracePeriodEnd,
        isGraceActive,
        isPremium,
        remaining,
      ] = await Promise.all([
        this.generateDeviceFingerprint(),
        this.getInstallTimestamp(),
        this.getGracePeriodEnd(),
        this.isGracePeriodActive(),
        this.isPremiumUser(),
        this.getRemainingGracePeriod(),
      ]);

      return {
        isActive: isGraceActive || isPremium,
        daysRemaining: remaining.days,
        hoursRemaining: remaining.hours,
        installTimestamp,
        gracePeriodEnd,
        isPremium,
        deviceFingerprint,
      };
    } catch (error) {
      console.error('Failed to get grace period status:', error);
      return {
        isActive: true, // Fail open
        daysRemaining: 0,
        hoursRemaining: 0,
        installTimestamp: Date.now(),
        gracePeriodEnd: Date.now(),
        isPremium: false,
        deviceFingerprint: 'error',
      };
    }
  }

  /**
   * Clear all grace period data (for testing/reset)
   */
  async clearGracePeriodData(): Promise<void> {
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.INSTALL_TIMESTAMP),
      AsyncStorage.removeItem(STORAGE_KEYS.DEVICE_FINGERPRINT),
      AsyncStorage.removeItem(STORAGE_KEYS.GRACE_PERIOD_END),
      AsyncStorage.removeItem(STORAGE_KEYS.PREMIUM_STATUS),
    ]);
  }
}

// React Hook using TanStack Query
export function useGracePeriodStatus() {
  const queryClient = useQueryClient();
  const manager = GracePeriodManager.getInstance();

  const query = useQuery({
    queryKey: ['grace-period-status'],
    queryFn: () => manager.getGracePeriodStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const clearMutation = useMutation({
    mutationFn: () => manager.clearGracePeriodData(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grace-period-status'] });
    },
  });

  return {
    ...query,
    clearData: clearMutation.mutate,
    isClearing: clearMutation.isPending,
  };
}

// Hook for checking if ads should be shown
export function useAdEligibility() {
  const { data: status, isLoading } = useGracePeriodStatus();

  const shouldShowAds = !isLoading && status && !status.isActive && !status.isPremium;
  const isGracePeriod = !isLoading && status && status.isActive && !status.isPremium;
  const isPremiumUser = !isLoading && status && status.isPremium;

  return {
    shouldShowAds,
    isGracePeriod,
    isPremiumUser,
    daysRemaining: status?.daysRemaining || 0,
    isLoading,
    status,
  };
}

// Premium activation hook
export function useActivatePremium() {
  const queryClient = useQueryClient();
  const manager = GracePeriodManager.getInstance();

  const mutation = useMutation({
    mutationFn: async (cardToken: string) => {
      const deviceFingerprint = await manager.generateDeviceFingerprint();
      
      // Call Supabase to activate premium
      const { data, error } = await supabase
        .from('premium_users')
        .upsert({
          device_fingerprint: deviceFingerprint,
          is_active: true,
          subscription_tier: 'pro',
          trial_ends_at: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7-day trial
          card_token: cardToken,
          created_at: Date.now(),
        })
        .select()
        .single();

      if (error) throw error;
      
      // Clear local cache
      await AsyncStorage.setItem(STORAGE_KEYS.PREMIUM_STATUS, 'true');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grace-period-status'] });
    },
  });

  return mutation;
}

// Export singleton instance
export const gracePeriodManager = GracePeriodManager.getInstance();

export default GracePeriodManager;