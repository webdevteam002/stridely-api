export const BILLING_ADAPTER = Symbol('BILLING_ADAPTER');

export type SubscriptionPlan =
  | 'free'
  | 'premiumMonthly'
  | 'premiumYearly'
  | 'lifetime'
  | 'enterprise';

export type SubscriptionStatus =
  | 'inactive'
  | 'active'
  | 'trialing'
  | 'expired'
  | 'canceled'
  | 'gracePeriod';

export type TrialStatus = 'none' | 'active' | 'expired' | 'consumed';

export type PremiumFeature =
  | 'unlimitedAiCoach'
  | 'advancedInsights'
  | 'cloudBackupPriority'
  | 'premiumChallenges'
  | 'advancedAnalytics'
  | 'futureFeatures';

export const PREMIUM_ENTITLEMENTS: PremiumFeature[] = [
  'unlimitedAiCoach',
  'advancedInsights',
  'cloudBackupPriority',
  'premiumChallenges',
  'advancedAnalytics',
];

export interface SubscriptionRecord {
  subscriptionId: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date | null;
  renewalType: 'none' | 'autoRenew' | 'manual';
  trialStatus: TrialStatus;
  entitlements: PremiumFeature[];
  receiptFingerprint?: string | null;
  verifiedAt?: Date | null;
  billingProvider: string;
}

export interface TrialRecord {
  trialId: string;
  userId: string;
  durationDays: number;
  startedAt: Date;
  expiresAt: Date;
  status: TrialStatus;
}

export interface PurchaseResult {
  status: 'success' | 'canceled' | 'pending' | 'failed' | 'alreadyOwned';
  subscription?: SubscriptionRecord;
  receiptPayload?: string;
  message?: string;
}

export interface BillingAdapter {
  readonly kind: string;
  readonly isAvailable: boolean;
  purchase(userId: string, plan: SubscriptionPlan): Promise<PurchaseResult>;
  restore(userId: string): Promise<PurchaseResult>;
  /** Future server-side receipt validation hook. */
  verifyReceipt(userId: string, receiptPayload: string): Promise<boolean>;
}
