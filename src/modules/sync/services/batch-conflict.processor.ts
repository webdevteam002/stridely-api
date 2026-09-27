import { Injectable, Logger } from '@nestjs/common';
import {
  ConflictResolverService,
  SyncOp,
} from './conflict-resolver.service';
import { VersionValidator } from './version.validator';
import { SyncProcessor } from './sync.processor';
import { BatchResult } from './batch.processor';

/**
 * Dedupes batch ops per entity, validates versions, then processes
 * deterministically (sorted by entity key then version).
 */
@Injectable()
export class BatchConflictProcessor {
  private readonly logger = new Logger(BatchConflictProcessor.name);

  constructor(
    private readonly processor: SyncProcessor,
    private readonly versions: VersionValidator,
    private readonly conflicts: ConflictResolverService,
  ) {}

  async processBatch(
    userId: string,
    deviceId: string | null,
    operations: SyncOp[],
    requestId?: string | null,
  ): Promise<BatchResult> {
    this.logger.log({
      msg: 'Batch conflict processing',
      userId,
      count: operations.length,
    });

    for (const op of operations) {
      this.versions.assertValid(op);
    }

    // Enrich ops with device/request for audit + LWW ties
    const enriched: SyncOp[] = operations.map((op) => ({
      ...op,
      deviceId: op.deviceId ?? deviceId,
      requestId: op.requestId ?? requestId ?? null,
    }));

    // Collapse same-entity ops: keep highest version (deterministic)
    const collapsed = this.collapseBatchConflicts(enriched);

    const applied: BatchResult['applied'] = [];
    const conflicts: BatchResult['conflicts'] = [];

    // Stable order for identical final state regardless of upload order
    const ordered = [...collapsed].sort((a, b) => {
      const ka = `${a.entityType}|${a.entityId}`;
      const kb = `${b.entityType}|${b.entityId}`;
      if (ka !== kb) return ka.localeCompare(kb);
      return this.versions.compareOps(a, b);
    });

    for (const op of ordered) {
      const outcome = await this.processor.processOp(
        userId,
        deviceId,
        op,
        requestId,
      );
      if (outcome.status === 'applied' || outcome.status === 'duplicate') {
        applied.push({
          entityType: outcome.entityType,
          entityId: outcome.entityId,
          version: outcome.version,
          status: outcome.status,
        });
      } else if (outcome.status === 'conflict') {
        conflicts.push({
          entityType: outcome.entityType,
          entityId: outcome.entityId,
          clientVersion: outcome.clientVersion,
          serverVersion: outcome.serverVersion,
          clientPayload: outcome.clientPayload,
          serverPayload: outcome.serverPayload,
          reason: outcome.reason,
        });
      }
    }

    return { applied, conflicts };
  }

  /**
   * Within one batch, multiple ops on the same entity collapse to one —
   * highest clientVersion wins; tie-break on clientUpdatedAt then index.
   * Marks as batch_conflict for observability via strategy metadata.
   */
  collapseBatchConflicts(operations: SyncOp[]): SyncOp[] {
    const groups = new Map<string, SyncOp[]>();
    for (const op of operations) {
      const key = `${op.entityType}|${op.entityId}`;
      const list = groups.get(key) ?? [];
      list.push(op);
      groups.set(key, list);
    }

    const out: SyncOp[] = [];
    for (const [, ops] of groups) {
      if (ops.length === 1) {
        out.push(ops[0]);
        continue;
      }
      this.logger.warn({
        msg: 'Conflict detected',
        conflictType: 'batch_conflict',
        entityType: ops[0].entityType,
        entityId: ops[0].entityId,
        count: ops.length,
      });
      // Prefer merge/union strategies when any op requests it
      const strategy =
        ops.find((o) => o.conflictStrategy === 'merge' || o.conflictStrategy === 'union')
          ?.conflictStrategy ??
        this.conflicts.strategyFor(ops[0].entityType, ops[0].conflictStrategy);

      const winner = [...ops].sort((a, b) => this.versions.compareOps(b, a))[0];
      out.push({
        ...winner,
        conflictStrategy: strategy,
        payload:
          strategy === 'merge' || strategy === 'union'
            ? ops.reduce(
                (acc, cur) => ({ ...acc, ...cur.payload }),
                {} as Record<string, unknown>,
              )
            : winner.payload,
      });
    }
    return out;
  }
}
