/**
 * MAVIN GRACE PERIOD MANAGER
 * Using expo-secure-store for encrypted persistence
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import * as Crypto from 'expo-crypto';
import * as Application from 'expo-application';
import * as React from 'react';
import { Platform } from 'react-native';
import { SecureStorage } from '../../storage/SecureStore';

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

const PremiumStatusSchema = z.object({
  status: z.enum([
    'free', 'grace_period', 'trial_active', 'premium', 'expired', 'cancelled'
  ]),
  installTimestamp: z.number(),
  gracePeriodEnd: z.number(),
  trialStartedAt: z.number().optional(),
  trialEndedAt: z.number().optional(),
  premiumUntil: z.number().optional(),
  deviceFingerprint: z.string().min(64),
  email: z.string().email().optional(),
  isTrialConversion: z.boolean().default(false),
  lastChecked: z.number().default(Date.now()),
});

export type PremiumStatus = z.infer<typeof PremiumStatusSchema>;

// ============================================================================
// GRACE PERIOD MANAGER
// ============================================================================

class GracePeriodManager {
  private static instance: GracePeriodManager;
  private deviceFingerprint: string | null = null;
  private readonly STORAGE_KEY = 'premium_status';
  private readonly FINGERPRINT_KEY = 'device_fingerprint';

  private constructor() {}

  static getInstance(): GracePeriodManager {
    if (!GracePeriodManager.instance) {
      GracePeriodManager.instance = new GracePeriodManager();
    }
    return GracePeriodManager.instance;
  }

  /**
   * Initialize - call once at app startup
   */
  async initialize(): Promise<void> {
    try {
      // Load or generate fingerprint
      this.deviceFingerprint = await SecureStorage.getItem<string>(this.FINGERPRINT_KEY);
      
      if (!this.deviceFingerprint) {
        this.deviceFingerprint = await this.generateDeviceFingerprint();
        await SecureStorage.setItem(this.FINGERPRINT_KEY, this.deviceFingerprint);
      }

      // Check if first launch
      const existing = await SecureStorage.getItem<PremiumStatus>(this.STORAGE_KEY);
      if (!existing) {
        await this.initializePremiumStatus();
      }

      console.log('[GracePeriod] Initialized');
    } catch (error) {
      console.error('[GracePeriod] Init failed:', error);
    }
  }

  /**
   * Get current premium status
   */
  async getPremiumStatus(): Promise<PremiumStatus> {
    try {
      // Try to get from secure storage
      const stored = await SecureStorage.getItem<PremiumStatus>(this.STORAGE_KEY);
      
      if (stored) {
        // Validate
        const validated = PremiumStatusSchema.parse(stored);
        
        // Check if grace period expired
        if (validated.status === 'grace_period' && Date.now() > validated.gracePeriodEnd) {
          const expired: PremiumStatus = {
            ...validated,
            status: 'free',
            lastChecked: Date.now()
          };
          await SecureStorage.setItem(this.STORAGE_KEY, expired);
          return expired;
        }
        
        return validated;
      }

      // First launch - create new
      return this.initializePremiumStatus();
    } catch (error) {
      console.error('[GracePeriod] Get failed:', error);
      
      // Emergency fallback
      return {
        status: 'free',
        installTimestamp: Date.now(),
        gracePeriodEnd: Date.now() + 7 * 24 * 60 * 60 * 1000,
        deviceFingerprint: this.deviceFingerprint || 'unknown',
        lastChecked: Date.now()
      };
    }
  }

  /**
   * Start trial
   */
  async startTrial(email: string, cardToken: string): Promise<PremiumStatus> {
    try {
      // Call your API
      const response = await fetch('https://api.mavin.app/premium/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_fingerprint: this.deviceFingerprint,
          email,
          card_token: cardToken
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const status = PremiumStatusSchema.parse({
        ...data,
        deviceFingerprint: this.deviceFingerprint,
        lastChecked: Date.now()
      });

      // Save securely
      await SecureStorage.setItem(this.STORAGE_KEY, status);
      
      return status;
    } catch (error) {
      console.error('[GracePeriod] Start trial failed:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(): Promise<PremiumStatus> {
    try {
      const response = await fetch('https://api.mavin.app/premium/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_fingerprint: this.deviceFingerprint
        })
      });

      const data = await response.json();
      const status = PremiumStatusSchema.parse({
        ...data,
        deviceFingerprint: this.deviceFingerprint,
        lastChecked: Date.now()
      });

      await SecureStorage.setItem(this.STORAGE_KEY, status);
      return status;
    } catch (error) {
      console.error('[GracePeriod] Cancel failed:', error);
      throw error;
    }
  }

  /**
   * Clear all data (for testing/logout)
   */
  async clearAllData(): Promise<void> {
    await SecureStorage.removeItem(this.STORAGE_KEY);
    await SecureStorage.removeItem(this.FINGERPRINT_KEY);
    this.deviceFingerprint = null;
  }

  /**
   * Get days remaining
   */
  getDaysRemaining(status: PremiumStatus): number {
    if (status.status === 'grace_period') {
      return Math.max(0, Math.ceil((status.gracePeriodEnd - Date.now()) / (24 * 60 * 60 * 1000)));
    }
    if (status.status === 'trial_active' && status.trialEndedAt) {
      return Math.max(0, Math.ceil((status.trialEndedAt - Date.now()) / (24 * 60 * 60 * 1000)));
    }
    if (status.status === 'premium' && status.premiumUntil) {
      return Math.max(0, Math.ceil((status.premiumUntil - Date.now()) / (24 * 60 * 60 * 1000)));
    }
    return 0;
  }

  // Private methods
  private async generateDeviceFingerprint(): Promise<string> {
    try {
      let deviceId = 'unknown';
      if (Platform.OS === 'android') {
        deviceId = (await Application.androidId) || 'android';
      } else {
        deviceId = Application.applicationId || 'ios';
      }
      
      const fingerprint = `${deviceId}:${Date.now()}:${Math.random()}`;
      
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        fingerprint
      );
      
      return hash.toLowerCase();
    } catch {
      // Fallback
      return `fp_${Date.now()}_${Math.random().toString(36)}`;
    }
  }

  private async initializePremiumStatus(): Promise<PremiumStatus> {
    const installTimestamp = Date.now();
    const gracePeriodEnd = installTimestamp + 7 * 24 * 60 * 60 * 1000;
    
    const status: PremiumStatus = {
      status: 'grace_period',
      installTimestamp,
      gracePeriodEnd,
      deviceFingerprint: this.deviceFingerprint || 'unknown',
      lastChecked: Date.now()
    };

    await SecureStorage.setItem(this.STORAGE_KEY, status);
    return status;
  }
}

// ============================================================================
// REACT HOOK
// ============================================================================

export const useGracePeriod = () => {
  const [isInitialized, setIsInitialized] = React.useState(false);
  const manager = React.useMemo(() => GracePeriodManager.getInstance(), []);

  React.useEffect(() => {
    manager.initialize().then(() => setIsInitialized(true));
  }, [manager]);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['premium_status'],
    queryFn: () => manager.getPremiumStatus(),
    enabled: isInitialized,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const startTrial = React.useCallback(async (email: string, cardToken: string) => {
    const result = await manager.startTrial(email, cardToken);
    refetch();
    return result;
  }, [manager, refetch]);

  const cancelSubscription = React.useCallback(async () => {
    const result = await manager.cancelSubscription();
    refetch();
    return result;
  }, [manager, refetch]);

  const clearAllData = React.useCallback(async () => {
    await manager.clearAllData();
    refetch();
  }, [manager, refetch]);

  const daysRemaining = status ? manager.getDaysRemaining(status) : 0;

  return {
    status,
    gracePeriodStatus: status?.status || 'free',
    isLoading: isLoading || !isInitialized,
    daysRemaining,
    isGracePeriodActive: status?.status === 'grace_period' && daysRemaining > 0,
    isTrialActive: status?.status === 'trial_active',
    isPremium: status?.status === 'premium',
    isFree: status?.status === 'free',
    deviceFingerprint: manager['deviceFingerprint'],
    startTrial,
    cancelSubscription,
    clearAllData,
    refresh: refetch
  };
};

export { GracePeriodManager };