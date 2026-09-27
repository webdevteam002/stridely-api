import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BILLING_ADAPTER } from '../providers/billing-adapter.interface';
import { MockBillingAdapter } from '../providers/mock-billing.adapter';
import { EntitlementService } from '../services/entitlement.service';
import { SubscriptionService } from '../services/subscription.service';
import { TrialService } from '../services/trial.service';

describe('Premium Platform (S7-T05)', () => {
  let subscriptions: SubscriptionService;
  let entitlements: EntitlementService;
  let trials: TrialService;
  let billing: MockBillingAdapter;
  const userId = 'user-premium-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementService,
        TrialService,
        SubscriptionService,
        MockBillingAdapter,
        { provide: BILLING_ADAPTER, useExisting: MockBillingAdapter },
      ],
    }).compile();

    subscriptions = module.get(SubscriptionService);
    entitlements = module.get(EntitlementService);
    trials = module.get(TrialService);
    billing = module.get(MockBillingAdapter);
    subscriptions.clear();
  });

  it('free plan has no entitlements', () => {
    const sub = subscriptions.getSubscription(userId);
    expect(sub.plan).toBe('free');
    expect(subscriptions.getEntitlements(userId)).toEqual([]);
    expect(subscriptions.canAccess(userId, 'unlimitedAiCoach')).toBe(false);
  });

  it('premium purchase grants entitlements after verification', async () => {
    const result = await subscriptions.purchase(userId, 'premiumMonthly');
    expect(result.status).toBe('success');
    expect(subscriptions.canAccess(userId, 'advancedInsights')).toBe(true);
    expect(subscriptions.getEntitlements(userId)).toContain('premiumChallenges');
  });

  it('trial start grants premium entitlements', () => {
    const { trial, subscription } = subscriptions.startTrial(userId, 7);
    expect(trial.durationDays).toBe(7);
    expect(subscription.status).toBe('trialing');
    expect(subscriptions.canAccess(userId, 'unlimitedAiCoach')).toBe(true);
  });

  it('one trial per account', () => {
    subscriptions.startTrial(userId, 7);
    expect(() => subscriptions.startTrial(userId, 14)).toThrow(ConflictException);
  });

  it('trial expiration clears entitlements', () => {
    subscriptions.startTrial(userId, 7);
    const trial = trials.get(userId)!;
    trial.expiresAt = new Date(Date.now() - 1000);
    const sub = subscriptions.getSubscription(userId);
    expect(sub.status).toBe('expired');
    expect(subscriptions.getEntitlements(userId)).toEqual([]);
    expect(trials.statusAt(userId)).toBe('expired');
  });

  it('entitlement evaluation for plans', () => {
    expect(entitlements.entitlementsFor('free')).toEqual([]);
    expect(entitlements.entitlementsFor('premiumYearly').length).toBeGreaterThan(0);
  });

  it('feature gating via canAccess', async () => {
    expect(subscriptions.canAccess(userId, 'cloudBackupPriority')).toBe(false);
    await subscriptions.purchase(userId, 'premiumYearly');
    expect(subscriptions.canAccess(userId, 'cloudBackupPriority')).toBe(true);
    expect(subscriptions.canAccess(userId, 'futureFeatures')).toBe(false);
  });

  it('mock billing provider purchase + verify', async () => {
    const purchased = await billing.purchase(userId, 'premiumMonthly');
    expect(purchased.status).toBe('success');
    expect(
      await billing.verifyReceipt(userId, purchased.receiptPayload!),
    ).toBe(true);
    expect(await billing.verifyReceipt(userId, 'invalid')).toBe(false);
  });
});
