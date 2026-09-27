import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  TrialRecord,
  TrialStatus,
} from '../providers/billing-adapter.interface';

@Injectable()
export class TrialService {
  private readonly trials = new Map<string, TrialRecord>();

  get(userId: string): TrialRecord | undefined {
    return this.trials.get(userId);
  }

  hasUsedTrial(userId: string): boolean {
    return this.trials.has(userId);
  }

  startTrial(
    userId: string,
    durationDays = 7,
    asOf = new Date(),
  ): TrialRecord {
    if (this.trials.has(userId)) {
      throw new ConflictException('One trial per account already used');
    }
    const days = durationDays === 14 ? 14 : durationDays <= 0 ? 7 : durationDays;
    if (days !== 7 && days !== 14) {
      // Allow configurable but document 7/14 as primary.
    }
    const record: TrialRecord = {
      trialId: randomUUID(),
      userId,
      durationDays: days,
      startedAt: asOf,
      expiresAt: new Date(asOf.getTime() + days * 86_400_000),
      status: 'active',
    };
    this.trials.set(userId, record);
    return record;
  }

  statusAt(userId: string, asOf = new Date()): TrialStatus {
    const trial = this.trials.get(userId);
    if (!trial) return 'none';
    if (trial.status === 'expired' || trial.status === 'consumed') {
      return trial.status;
    }
    if (trial.expiresAt > asOf) return 'active';
    trial.status = 'expired';
    return 'expired';
  }

  /** Test helper */
  clear(): void {
    this.trials.clear();
  }
}
