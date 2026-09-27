import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PurchaseDto {
  @IsIn(['premiumMonthly', 'premiumYearly'])
  plan!: 'premiumMonthly' | 'premiumYearly';
}

export class StartTrialDto {
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(14)
  durationDays?: number;
}

export class VerifyReceiptDto {
  @IsString()
  receiptPayload!: string;
}

export class FeatureCheckDto {
  @IsIn([
    'unlimitedAiCoach',
    'advancedInsights',
    'cloudBackupPriority',
    'premiumChallenges',
    'advancedAnalytics',
    'futureFeatures',
  ])
  feature!: string;
}
