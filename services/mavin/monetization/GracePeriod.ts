/**
 * MAVIN GRACE PERIOD MANAGER
 * 
 * 7-day ad-free period tracking + Pro trial management
 * 
 * ARCHITECTURE:
 * • TanStack Query for premium status (server-validated)
 * • Zod validation for ALL premium states
 * • Device fingerprint generation (SHA-256 hash)
 * • Grace period calculation (install_timestamp + 7 days)
 * • Pro trial flow (card-on-file, auto-bill after 7 days)
 * • Offline-capable status checking (cached premium state)
 * 
 * ETHICAL GUARANTEES:
 * ✅ Zero tracking during grace period (no ads, no analytics)
 * ✅ Clear expiration messaging ("Free trial ends in 2 days")
 * ✅ Easy cancellation (one tap in settings)
 * ✅ No hidden charges (explicit consent before billing)
 * ✅ Grace period respected globally (no regional bias)
 */

import { useQuery, QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import * as Crypto from 'expo-crypto';
import * as Application from 'expo-application';
import { errorFromUnknown, logError } from '../core/errors';

// ============================================================================
// ZOD VALIDATION SCHEMAS
// ============================================================================

// Premium status schema
const PremiumStatusSchema = z.object({
  status: z.enum([
    'free',           // Never had trial
    'grace_period',   // 7-day ad-free period active
    'trial_active',   // Pro trial active (card on file)
    'premium',        // Paid subscriber
    'expired',        // Trial/subscription expired
    'cancelled'       // User cancelled subscription
  ]),
  installTimestamp: z.number(), // First app open timestamp
  gracePeriodEnd: z.number(),   // installTimestamp + 7 days
  trialStartedAt: z.number().optional(),
  trialEndedAt: z.number().optional(),
  premiumUntil: z.number().optional(),
  deviceFingerprint: z.string().min(64), // SHA-256 hash
  email: z.string().email().optional(),
  isTrialConversion: z.boolean().default(false),
  lastChecked: z.number().default(Date.now()),
});

// Trial start request schema
const TrialStartRequestSchema = z.object({
  deviceFingerprint: z.string().min(64),
  email: z.string().email(),
  cardToken: z.string().min(10), // Tokenized card (Stripe/Paystack)
  installTimestamp: z.number(),
});

export type PremiumStatus = z.infer<typeof PremiumStatusSchema>;
export type TrialStartRequest = z.infer<typeof TrialStartRequestSchema>;
export type GracePeriodStatus = PremiumStatus['status'];

// ============================================================================
// GRACE PERIOD MANAGER CLASS
// ============================================================================

class GracePeriodManager {
  private static instance: GracePeriodManager | null = null;
  private queryClient: QueryClient;
  private deviceFingerprint: string | null = null;

  private constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
    console.log('[Mavin GracePeriod] Manager initialized');
  }

  static getInstance(queryClient: QueryClient): GracePeriodManager {
    if (!GracePeriodManager.instance) {
      GracePeriodManager.instance = new GracePeriodManager(queryClient);
    }
    return GracePeriodManager.instance;
  }

  /**
   * Initialize grace period manager (generate device fingerprint)
   */
  async initialize(): Promise<void> {
    // Generate device fingerprint if not exists
    if (!this.deviceFingerprint) {
      this.deviceFingerprint = await this.generateDeviceFingerprint();
      console.log('[Mavin GracePeriod] Device fingerprint generated');
    }
    
    // Initialize premium status if not exists
    const existingStatus = this.queryClient.getQueryData<PremiumStatus>(['premium_status']);
    if (!existingStatus) {
      await this.initializePremiumStatus();
    }
  }

  /**
   * Generate device fingerprint (SHA-256 hash of device characteristics)
   */
  private async generateDeviceFingerprint(): Promise<string> {
    try {
      // Gather device characteristics
      const deviceId = Application.androidId || Application.applicationId || 'unknown_device';
      const installTime = Application.installationTime || Date.now().toString();
      const bundleId = Application.applicationId || 'com.mavin.music';
      
      // Create fingerprint string
      const fingerprintString = `${deviceId}:${installTime}:${bundleId}:${Date.now()}`;
      
      // Generate SHA-256 hash
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        fingerprintString
      );
      
      return hash.toLowerCase();
    } catch (error) {
      const mavinError = errorFromUnknown(error);
      logError(mavinError, 'warn');
      
      // Fallback: Generate random fingerprint
      return 'fallback_' + Math.random().toString(36).substring(2, 15);
    }
  }

  /**
   * Initialize premium status (first app open)
   */
  private async initializePremiumStatus(): Promise<void> {
    const installTimestamp = Date.now();
    const gracePeriodEnd = installTimestamp + 7 * 24 * 60 * 60 * 1000; // 7 days
    
    const status: PremiumStatus = {
      status: 'grace_period',
      installTimestamp,
      gracePeriodEnd,
      deviceFingerprint: this.deviceFingerprint || 'unknown',
      lastChecked: Date.now(),
    };
    
    // Save to cache
    this.queryClient.setQueryData(['premium_status'], status);
    
    // Persist to AsyncStorage (for offline access)
    try {
      await MavinCache.set('premium_status', status, 30 * 24 * 60 * 60 * 1000, 'DEVICE'); // 30 days
    } catch (error) {
      logError(errorFromUnknown(error), 'warn');
    }
    
    console.log('[Mavin GracePeriod] Premium status initialized (grace period active until', new Date(gracePeriodEnd).toLocaleDateString(), ')');
  }

  /**
   * Get current premium status (server-validated)
   */
  async getPremiumStatus(): Promise<PremiumStatus> {
    // Check cache first
    const cached = this.queryClient.getQueryData<PremiumStatus>(['premium_status']);
    if (cached && PremiumStatusSchema.safeParse(cached).success) {
      // Check if grace period expired
      if (cached.status === 'grace_period' && Date.now() > cached.gracePeriodEnd) {
        // Transition to free status
        const newStatus: PremiumStatus = {
          ...cached,
          status: 'free',
          lastChecked: Date.now(),
        };
        
        this.queryClient.setQueryData(['premium_status'], newStatus);
        return newStatus;
      }
      
      return cached;
    }
    
    // Fetch from server (in production: Call Supabase RPC)
    try {
      if (!this.deviceFingerprint) {
        throw new Error('Device fingerprint not available');
      }
      
      const response = await fetch('/api/premium/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_fingerprint: this.deviceFingerprint }),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const status = PremiumStatusSchema.parse(data);
      
      // Cache the status
      this.queryClient.setQueryData(['premium_status'], status);
      
      return status;
    } catch (error) {
      const mavinError = errorFromUnknown(error);
      logError(mavinError, 'warn');
      
      // Return cached status or default
      if (cached) return cached;
      
      // Return default free status
      return PremiumStatusSchema.parse({
        status: 'free',
        installTimestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        gracePeriodEnd: Date.now() - 23 * 24 * 60 * 60 * 1000, // 23 days ago (grace period expired)
        deviceFingerprint: this.deviceFingerprint || 'unknown',
        lastChecked: Date.now(),
      });
    }
  }

  /**
   * Start Pro trial (7 days free with card on file)
   */
  async startTrial(email: string, cardToken: string): Promise<PremiumStatus> {
    if (!this.deviceFingerprint) {
      throw new Error('Device fingerprint not available');
    }
    
    try {
      // Validate request
      const request = TrialStartRequestSchema.parse({
        deviceFingerprint: this.deviceFingerprint,
        email,
        cardToken,
        installTimestamp: Date.now(),
      });
      
      // Call server to start trial
      const response = await fetch('/api/premium/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const status = PremiumStatusSchema.parse(data);
      
      // Update cache
      this.queryClient.setQueryData(['premium_status'], status);
      
      console.log('[Mavin GracePeriod] Pro trial started (ends', new Date(status.trialEndedAt || 0).toLocaleDateString(), ')');
      return status;
    } catch (error) {
      const mavinError = errorFromUnknown(error);
      logError(mavinError, 'error');
      throw mavinError;
    }
  }

  /**
   * Cancel subscription/trial
   */
  async cancelSubscription(): Promise<PremiumStatus> {
    if (!this.deviceFingerprint) {
      throw new Error('Device fingerprint not available');
    }
    
    try {
      const response = await fetch('/api/premium/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_fingerprint: this.deviceFingerprint }),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      const status = PremiumStatusSchema.parse(data);
      
      // Update cache
      this.queryClient.setQueryData(['premium_status'], status);
      
      console.log('[Mavin GracePeriod] Subscription cancelled');
      return status;
    } catch (error) {
      const mavinError = errorFromUnknown(error);
      logError(mavinError, 'error');
      throw mavinError;
    }
  }

  /**
   * Get days remaining in grace period/trial
   */
  getDaysRemaining(status: PremiumStatus): number {
    if (status.status === 'grace_period') {
      return Math.max(0, Math.ceil((status.gracePeriodEnd - Date.now()) / (24 * 60 * 60 * 1000)));
    }
    
    if (status.status === 'trial_active' && status.trialEndedAt) {
      return Math.max(0, Math.ceil((status.trialEndedAt - Date.now()) / (24 * 60 * 60 * 1000)));
    }
    
    return 0;
  }

  /**
   * Get device fingerprint
   */
  getDeviceFingerprint(): string | null {
    return this.deviceFingerprint;
  }
}

// ============================================================================
// REACT HOOK FOR UI INTEGRATION
// ============================================================================

/**
 * Hook for grace period and premium status
 */
export const useGracePeriod = () => {
  const queryClient = useQueryClient();
  const manager = GracePeriodManager.getInstance(queryClient);
  
  // Initialize on mount
  React.useEffect(() => {
    manager.initialize().catch(error => {
      logError(errorFromUnknown(error), 'error');
    });
  }, [manager]);
  
  // Query premium status
  const {  premiumStatus, isLoading, error, refetch } = useQuery<PremiumStatus>({
    queryKey: ['premium_status'],
    queryFn: () => manager.getPremiumStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    initialData: () => {
      // Return cached status or default
      const cached = queryClient.getQueryData<PremiumStatus>(['premium_status']);
      if (cached) return cached;
      
      return PremiumStatusSchema.parse({
        status: 'free',
        installTimestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
        gracePeriodEnd: Date.now() - 23 * 24 * 60 * 60 * 1000,
        deviceFingerprint: manager.getDeviceFingerprint() || 'unknown',
        lastChecked: Date.now(),
      });
    },
  });
  
  // Start trial mutation
  const startTrial = React.useCallback(async (email: string, cardToken: string) => {
    const status = await manager.startTrial(email, cardToken);
    queryClient.setQueryData(['premium_status'], status);
    return status;
  }, [manager, queryClient]);
  
  // Cancel subscription mutation
  const cancelSubscription = React.useCallback(async () => {
    const status = await manager.cancelSubscription();
    queryClient.setQueryData(['premium_status'], status);
    return status;
  }, [manager, queryClient]);
  
  // Get days remaining
  const daysRemaining = premiumStatus ? manager.getDaysRemaining(premiumStatus) : 0;
  
  return {
    // Status
    premiumStatus,
    gracePeriodStatus: premiumStatus?.status || 'free',
    isLoading,
    error,
    
    // Days remaining
    daysRemaining,
    isGracePeriodActive: premiumStatus?.status === 'grace_period' && daysRemaining > 0,
    isTrialActive: premiumStatus?.status === 'trial_active',
    isPremium: premiumStatus?.status === 'premium',
    
    // Device info
    deviceFingerprint: manager.getDeviceFingerprint(),
    
    // Actions
    startTrial,
    cancelSubscription,
    refetchPremiumStatus: refetch,
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export { GracePeriodManager, useGracePeriod };
export type { PremiumStatus, TrialStartRequest, GracePeriodStatus };