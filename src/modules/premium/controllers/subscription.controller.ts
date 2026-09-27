import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/decorators/current-user.decorator';
import {
  PurchaseDto,
  StartTrialDto,
  VerifyReceiptDto,
} from '../dto/premium.dto';
import type { PremiumFeature } from '../providers/billing-adapter.interface';
import { SubscriptionService } from '../services/subscription.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    const sub = this.subscriptions.getSubscription(user.userId);
    return {
      subscription: sub,
      entitlements: this.subscriptions.getEntitlements(user.userId),
      trialStatus: this.subscriptions.trialStatus(user.userId),
    };
  }

  @Get('entitlements')
  entitlements(@CurrentUser() user: AuthUser) {
    return {
      entitlements: this.subscriptions.getEntitlements(user.userId),
    };
  }

  @Get('features/:feature')
  feature(
    @CurrentUser() user: AuthUser,
    @Param('feature') feature: PremiumFeature,
  ) {
    return {
      feature,
      entitled: this.subscriptions.canAccess(user.userId, feature),
    };
  }

  @Post('purchase')
  purchase(@CurrentUser() user: AuthUser, @Body() dto: PurchaseDto) {
    return this.subscriptions.purchase(user.userId, dto.plan);
  }

  @Post('restore')
  restore(@CurrentUser() user: AuthUser) {
    return this.subscriptions.restore(user.userId);
  }

  @Post('trial')
  startTrial(@CurrentUser() user: AuthUser, @Body() dto: StartTrialDto) {
    return this.subscriptions.startTrial(user.userId, dto.durationDays ?? 7);
  }

  @Post('verify-receipt')
  verifyReceipt(@CurrentUser() user: AuthUser, @Body() dto: VerifyReceiptDto) {
    return this.subscriptions.verifyReceipt(user.userId, dto.receiptPayload);
  }
}
