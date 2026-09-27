import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  BillingAdapter,
  PREMIUM_ENTITLEMENTS,
  PurchaseResult,
  SubscriptionPlan,
  SubscriptionRecord,
} from './billing-adapter.interface';

@Injectable()
export class MockBillingAdapter implements BillingAdapter {
  readonly kind = 'mock';
  readonly isAvailable = true;

  private readonly owned = new Map<string, SubscriptionRecord>();

  async purchase(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<PurchaseResult> {
    if (plan === 'free') {
      return { status: 'canceled', message: 'Cannot purchase free plan' };
    }
    if (plan === 'lifetime' || plan === 'enterprise') {
      return { status: 'failed', message: `Plan not implemented: ${plan}` };
    }

    const now = new Date();
    const days = plan === 'premiumYearly' ? 365 : 30;
    const subscription: SubscriptionRecord = {
      subscriptionId: randomUUID(),
      userId,
      plan,
      status: 'active',
      startedAt: now,
      expiresAt: new Date(now.getTime() + days * 86_400_000),
      renewalType: 'autoRenew',
      trialStatus: 'none',
      entitlements: [...PREMIUM_ENTITLEMENTS],
      receiptFingerprint: `mock-receipt-${plan}-${userId}`,
      verifiedAt: null,
      billingProvider: this.kind,
    };
    this.owned.set(userId, subscription);
    return {
      status: 'success',
      subscription,
      receiptPayload: subscription.receiptFingerprint!,
      message: 'Mock purchase success',
    };
  }

  async restore(userId: string): Promise<PurchaseResult> {
    const sub = this.owned.get(userId);
    if (!sub) {
      return { status: 'failed', message: 'Nothing to restore' };
    }
    return {
      status: 'success',
      subscription: sub,
      receiptPayload: sub.receiptFingerprint ?? undefined,
    };
  }

  async verifyReceipt(
    userId: string,
    receiptPayload: string,
  ): Promise<boolean> {
    return (
      receiptPayload.startsWith('mock-receipt-') &&
      receiptPayload.includes(userId)
    );
  }
}
