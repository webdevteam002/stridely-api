import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BILLING_ADAPTER } from '../providers/billing-adapter.interface';
import type {
  BillingAdapter,
  PremiumFeature,
  SubscriptionPlan,
  SubscriptionRecord,
} from '../providers/billing-adapter.interface';
import { EntitlementService } from './entitlement.service';
import { TrialService } from './trial.service';

@Injectable()
export class SubscriptionService {
  private readonly byUser = new Map<string, SubscriptionRecord>();

  constructor(
    @Inject(BILLING_ADAPTER) private readonly billing: BillingAdapter,
    private readonly entitlements: EntitlementService,
    private readonly trials: TrialService,
  ) {}

  getOrCreateFree(userId: string): SubscriptionRecord {
    const existing = this.byUser.get(userId);
    if (existing) {
      return this.refreshExpiry(existing);
    }
    const free: SubscriptionRecord = {
      subscriptionId: randomUUID(),
      userId,
      plan: 'free',
      status: 'inactive',
      startedAt: new Date(),
      expiresAt: null,
      renewalType: 'none',
      trialStatus: 'none',
      entitlements: [],
      billingProvider: this.billing.kind,
      verifiedAt: null,
    };
    this.byUser.set(userId, free);
    return free;
  }

  getSubscription(userId: string): SubscriptionRecord {
    let sub = this.refreshExpiry(this.getOrCreateFree(userId));
    if (
      sub.status === 'trialing' &&
      this.trials.statusAt(userId) === 'expired'
    ) {
      sub = {
        ...sub,
        status: 'expired',
        trialStatus: 'expired',
        entitlements: [],
      };
      this.byUser.set(userId, sub);
    }
    return sub;
  }

  getEntitlements(userId: string): PremiumFeature[] {
    return this.entitlements.evaluate(this.getSubscription(userId));
  }

  canAccess(userId: string, feature: PremiumFeature): boolean {
    return this.entitlements.isEntitled(this.getSubscription(userId), feature);
  }

  async purchase(userId: string, plan: SubscriptionPlan) {
    if (!this.billing.isAvailable) {
      throw new BadRequestException('Billing provider unavailable');
    }
    const result = await this.billing.purchase(userId, plan);
    if (result.status === 'success' && result.subscription) {
      const receipt = result.receiptPayload ?? '';
      const verified = await this.billing.verifyReceipt(userId, receipt);
      if (!verified) {
        return {
          status: 'pending' as const,
          message: 'Awaiting server receipt verification',
        };
      }
      const verifiedSub: SubscriptionRecord = {
        ...result.subscription,
        verifiedAt: new Date(),
      };
      this.byUser.set(userId, verifiedSub);
      return { status: 'success' as const, subscription: verifiedSub };
    }
    return result;
  }

  async restore(userId: string) {
    const result = await this.billing.restore(userId);
    if (result.status === 'success' && result.subscription) {
      const verified: SubscriptionRecord = {
        ...result.subscription,
        verifiedAt: new Date(),
      };
      this.byUser.set(userId, verified);
      return { status: 'success' as const, subscription: verified };
    }
    return result;
  }

  startTrial(userId: string, durationDays = 7) {
    const trial = this.trials.startTrial(userId, durationDays);
    const sub: SubscriptionRecord = {
      subscriptionId: randomUUID(),
      userId,
      plan: 'premiumMonthly',
      status: 'trialing',
      startedAt: trial.startedAt,
      expiresAt: trial.expiresAt,
      renewalType: 'none',
      trialStatus: 'active',
      entitlements: this.entitlements.entitlementsFor('premiumMonthly'),
      billingProvider: this.billing.kind,
      verifiedAt: new Date(),
    };
    this.byUser.set(userId, sub);
    return { trial, subscription: sub };
  }

  /** Explicit verification hook for store receipts. */
  async verifyReceipt(userId: string, receiptPayload: string) {
    const ok = await this.billing.verifyReceipt(userId, receiptPayload);
    if (!ok) {
      throw new BadRequestException('Receipt verification failed');
    }
    const current = this.getSubscription(userId);
    if (current.receiptFingerprint === receiptPayload) {
      current.verifiedAt = new Date();
      this.byUser.set(userId, current);
    }
    return { verified: true, verifiedAt: current.verifiedAt };
  }

  trialStatus(userId: string) {
    return this.trials.statusAt(userId);
  }

  /** Test helper */
  clear(): void {
    this.byUser.clear();
    this.trials.clear();
  }

  private refreshExpiry(sub: SubscriptionRecord): SubscriptionRecord {
    const now = new Date();
    if (
      (sub.status === 'active' ||
        sub.status === 'trialing' ||
        sub.status === 'gracePeriod') &&
      sub.expiresAt &&
      !(sub.expiresAt > now)
    ) {
      const expired: SubscriptionRecord = {
        ...sub,
        status: 'expired',
        trialStatus:
          sub.trialStatus === 'active' ? 'expired' : sub.trialStatus,
        entitlements: [],
      };
      this.byUser.set(sub.userId, expired);
      return expired;
    }
    return sub;
  }
}
