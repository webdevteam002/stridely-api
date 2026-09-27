import { Injectable } from '@nestjs/common';
import {
  PREMIUM_ENTITLEMENTS,
  PremiumFeature,
  SubscriptionPlan,
  SubscriptionRecord,
} from '../providers/billing-adapter.interface';

@Injectable()
export class EntitlementService {
  entitlementsFor(plan: SubscriptionPlan): PremiumFeature[] {
    if (
      plan === 'premiumMonthly' ||
      plan === 'premiumYearly' ||
      plan === 'lifetime' ||
      plan === 'enterprise'
    ) {
      return [...PREMIUM_ENTITLEMENTS];
    }
    return [];
  }

  evaluate(subscription: SubscriptionRecord, asOf = new Date()): PremiumFeature[] {
    if (!this.isActive(subscription, asOf)) {
      return [];
    }
    if (subscription.entitlements?.length) {
      return subscription.entitlements.filter((f) => f !== 'futureFeatures');
    }
    return this.entitlementsFor(subscription.plan);
  }

  isEntitled(
    subscription: SubscriptionRecord,
    feature: PremiumFeature,
    asOf = new Date(),
  ): boolean {
    if (feature === 'futureFeatures') return false;
    return this.evaluate(subscription, asOf).includes(feature);
  }

  isActive(subscription: SubscriptionRecord, asOf = new Date()): boolean {
    if (
      subscription.status !== 'active' &&
      subscription.status !== 'trialing' &&
      subscription.status !== 'gracePeriod'
    ) {
      return false;
    }
    if (subscription.expiresAt && !(subscription.expiresAt > asOf)) {
      return false;
    }
    return true;
  }
}
