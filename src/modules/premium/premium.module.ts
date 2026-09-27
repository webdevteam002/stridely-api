import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionController } from './controllers/subscription.controller';
import { BILLING_ADAPTER } from './providers/billing-adapter.interface';
import { MockBillingAdapter } from './providers/mock-billing.adapter';
import { EntitlementService } from './services/entitlement.service';
import { SubscriptionService } from './services/subscription.service';
import { TrialService } from './services/trial.service';

@Module({
  imports: [AuthModule],
  controllers: [SubscriptionController],
  providers: [
    EntitlementService,
    TrialService,
    SubscriptionService,
    MockBillingAdapter,
    {
      provide: BILLING_ADAPTER,
      useExisting: MockBillingAdapter,
    },
  ],
  exports: [SubscriptionService, EntitlementService, TrialService, BILLING_ADAPTER],
})
export class PremiumModule {}
