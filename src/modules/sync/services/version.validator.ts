import { BadRequestException, Injectable } from '@nestjs/common';
import { SyncOp } from './conflict-resolver.service';

@Injectable()
export class VersionValidator {
  /** Validate client version + timestamps before conflict evaluation. */
  assertValid(op: SyncOp): void {
    if (!op.entityType || !op.entityId) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'entityType and entityId are required',
      });
    }
    if (!Number.isInteger(op.clientVersion) || op.clientVersion < 1) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'clientVersion must be an integer >= 1',
      });
    }
    if (op.clientUpdatedAt) {
      const t = Date.parse(op.clientUpdatedAt);
      if (Number.isNaN(t)) {
        throw new BadRequestException({
          code: 'INVALID_PAYLOAD',
          message: 'clientUpdatedAt must be ISO-8601',
        });
      }
      // Clock skew guard: reject timestamps > 24h in the future
      if (t - Date.now() > 24 * 60 * 60 * 1000) {
        throw new BadRequestException({
          code: 'CLOCK_SKEW',
          message: 'clientUpdatedAt is too far in the future',
        });
      }
    }
  }

  /**
   * Deterministic ranking for batch dedupe:
   * higher version wins; tie-break on later clientUpdatedAt; then stable op index.
   */
  compareOps(a: SyncOp, b: SyncOp): number {
    if (a.clientVersion !== b.clientVersion) {
      return a.clientVersion - b.clientVersion;
    }
    const at = a.clientUpdatedAt ? Date.parse(a.clientUpdatedAt) : 0;
    const bt = b.clientUpdatedAt ? Date.parse(b.clientUpdatedAt) : 0;
    return at - bt;
  }
}
