import { Injectable, Logger } from '@nestjs/common';
import { MergeEngine, ConflictStrategy } from './merge.engine';

export type { ConflictStrategy };

export type SyncOp = {
  entityType: string;
  entityId: string;
  operation: string;
  clientVersion: number;
  payload: Record<string, unknown>;
  clientUpdatedAt?: string | null;
  conflictStrategy?: ConflictStrategy | null;
  deviceId?: string | null;
  requestId?: string | null;
};

export type ExistingRecord = {
  version: number;
  payload: Record<string, unknown>;
  updatedAt: Date;
  deletedAt: Date | null;
  deviceId?: string | null;
};

export type ConflictType =
  | 'update_vs_update'
  | 'update_vs_delete'
  | 'delete_vs_delete'
  | 'create_vs_create'
  | 'version_conflict'
  | 'timestamp_conflict'
  | 'batch_conflict';

export type ProcessOutcome =
  | {
      status: 'applied';
      version: number;
      payload: Record<string, unknown>;
      strategy: ConflictStrategy;
      conflictType?: ConflictType;
      merged?: boolean;
    }
  | {
      status: 'conflict';
      clientVersion: number;
      serverVersion: number;
      clientPayload: Record<string, unknown>;
      serverPayload: Record<string, unknown>;
      reason: string;
      conflictType: ConflictType;
      strategy: ConflictStrategy;
    }
  | {
      status: 'duplicate';
      version: number;
      payload: Record<string, unknown>;
      reason: 'idempotent' | 'delete_vs_delete' | 'replay';
    };

/**
 * Production multi-device conflict resolver.
 * Deterministic for identical inputs regardless of device order.
 */
@Injectable()
export class ConflictResolverService {
  private readonly logger = new Logger(ConflictResolverService.name);

  constructor(private readonly mergeEngine: MergeEngine) {}

  strategyFor(
    entityType: string,
    override?: ConflictStrategy | null,
  ): ConflictStrategy {
    if (override) return override;
    const t = this.mergeEngine.normalizeType(entityType);
    switch (t) {
      case 'preference':
      case 'goal':
        return 'last_write_wins';
      case 'movement_session':
      case 'history':
      case 'goal_history':
      case 'daily_activity':
      case 'profile':
        return 'merge';
      case 'achievement':
        return 'union';
      default:
        return 'last_write_wins';
    }
  }

  classifyConflict(
    op: SyncOp,
    existing: ExistingRecord,
  ): ConflictType {
    const clientDelete =
      op.operation === 'delete' || op.operation === 'soft_delete';
    const serverDeleted = !!existing.deletedAt;
    if (clientDelete && serverDeleted) return 'delete_vs_delete';
    if (clientDelete || serverDeleted) return 'update_vs_delete';
    if (op.operation === 'create' && existing.version >= 1) {
      return 'create_vs_create';
    }
    if (op.clientVersion < existing.version) return 'version_conflict';
    return 'update_vs_update';
  }

  evaluate(op: SyncOp, existing: ExistingRecord | null): ProcessOutcome {
    // Create on empty / tombstone revive
    if (!existing) {
      return {
        status: 'applied',
        version: Math.max(1, op.clientVersion),
        payload: op.payload,
        strategy: this.strategyFor(op.entityType, op.conflictStrategy),
      };
    }

    const conflictType = this.classifyConflict(op, existing);
    const strategy = this.strategyFor(op.entityType, op.conflictStrategy);

    // Delete vs delete — idempotent
    if (conflictType === 'delete_vs_delete') {
      this.logger.log({
        msg: 'Duplicate ignored',
        reason: 'delete_vs_delete',
        entityType: op.entityType,
        entityId: op.entityId,
      });
      return {
        status: 'duplicate',
        version: existing.version,
        payload: existing.payload,
        reason: 'delete_vs_delete',
      };
    }

    // Same version + identical payload → idempotent replay
    if (op.clientVersion === existing.version) {
      if (this.payloadEqual(op.payload, existing.payload)) {
        this.logger.log({
          msg: 'Duplicate ignored',
          reason: 'idempotent_version',
          entityType: op.entityType,
          entityId: op.entityId,
        });
        return {
          status: 'duplicate',
          version: existing.version,
          payload: existing.payload,
          reason: 'idempotent',
        };
      }
      if (
        conflictType !== 'update_vs_delete'
      ) {
        // Same version, different payload (multi-device) → resolve by strategy
        this.logger.warn({
          msg: 'Conflict detected',
          conflictType: 'version_conflict',
          strategy,
          entityType: op.entityType,
          entityId: op.entityId,
          clientVersion: op.clientVersion,
          serverVersion: existing.version,
        });
        return this.resolve(op, existing, 'version_conflict', strategy);
      }
    }

    // Fast-forward: client ahead (including deletes)
    if (op.clientVersion > existing.version && !existing.deletedAt) {
      return {
        status: 'applied',
        version: op.clientVersion,
        payload: op.payload,
        strategy,
      };
    }

    this.logger.warn({
      msg: 'Conflict detected',
      conflictType,
      strategy,
      entityType: op.entityType,
      entityId: op.entityId,
      clientVersion: op.clientVersion,
      serverVersion: existing.version,
    });

    return this.resolve(op, existing, conflictType, strategy);
  }

  resolve(
    op: SyncOp,
    existing: ExistingRecord,
    conflictType: ConflictType,
    strategy: ConflictStrategy,
  ): ProcessOutcome {
    const clientDelete =
      op.operation === 'delete' || op.operation === 'soft_delete';

    // Update vs delete — LWW by timestamp; delete wins if newer or equal
    if (conflictType === 'update_vs_delete') {
      const clientAt = op.clientUpdatedAt
        ? Date.parse(op.clientUpdatedAt)
        : Date.now();
      const serverAt = existing.updatedAt.getTime();
      if (clientDelete) {
        if (clientAt >= serverAt) {
          return {
            status: 'applied',
            version: Math.max(existing.version + 1, op.clientVersion),
            payload: op.payload,
            strategy: 'last_write_wins',
            conflictType,
          };
        }
        return {
          status: 'duplicate',
          version: existing.version,
          payload: existing.payload,
          reason: 'idempotent',
        };
      }
      // Server deleted, client updates
      if (serverAt > clientAt) {
        return {
          status: 'duplicate',
          version: existing.version,
          payload: existing.payload,
          reason: 'idempotent',
        };
      }
      return {
        status: 'applied',
        version: Math.max(existing.version + 1, op.clientVersion),
        payload: op.payload,
        strategy: 'last_write_wins',
        conflictType,
      };
    }

    if (strategy === 'client_wins') {
      return {
        status: 'applied',
        version: Math.max(existing.version + 1, op.clientVersion),
        payload: op.payload,
        strategy,
        conflictType,
      };
    }
    if (strategy === 'server_wins') {
      return {
        status: 'duplicate',
        version: existing.version,
        payload: existing.payload,
        reason: 'idempotent',
      };
    }

    if (strategy === 'merge' || strategy === 'union') {
      const merged = this.mergeEngine.merge(
        op.entityType,
        strategy,
        existing.payload,
        op.payload,
      );
      return {
        status: 'applied',
        version: Math.max(existing.version, op.clientVersion) + 1,
        payload: merged,
        strategy,
        conflictType,
        merged: true,
      };
    }

    // last_write_wins (+ timestamp_conflict)
    const clientAt = op.clientUpdatedAt
      ? Date.parse(op.clientUpdatedAt)
      : Date.now();
    const serverAt = existing.updatedAt.getTime();
    const type: ConflictType =
      clientAt === serverAt ? 'timestamp_conflict' : conflictType;

    if (clientAt > serverAt) {
      return {
        status: 'applied',
        version: Math.max(existing.version + 1, op.clientVersion),
        payload: op.payload,
        strategy: 'last_write_wins',
        conflictType: type,
      };
    }
    if (clientAt < serverAt) {
      // Server wins — keep existing; client must pull
      return {
        status: 'duplicate',
        version: existing.version,
        payload: existing.payload,
        reason: 'idempotent',
      };
    }

    // Exact timestamp tie — deterministic by deviceId then payload hash
    const clientDevice = op.deviceId ?? '';
    const serverDevice = existing.deviceId ?? '';
    if (clientDevice && serverDevice && clientDevice !== serverDevice) {
      const preferClient = clientDevice.localeCompare(serverDevice) > 0;
      return {
        status: 'applied',
        version: preferClient
          ? Math.max(existing.version + 1, op.clientVersion)
          : existing.version,
        payload: preferClient ? op.payload : existing.payload,
        strategy: 'last_write_wins',
        conflictType: 'timestamp_conflict',
      };
    }

    return {
      status: 'conflict',
      clientVersion: op.clientVersion,
      serverVersion: existing.version,
      clientPayload: op.payload,
      serverPayload: existing.payload,
      reason: 'unresolved_tie',
      conflictType: type,
      strategy,
    };
  }

  private payloadEqual(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
