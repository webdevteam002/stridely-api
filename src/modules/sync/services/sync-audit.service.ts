import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  ConflictType,
  ConflictStrategy,
  ProcessOutcome,
  SyncOp,
  ExistingRecord,
} from './conflict-resolver.service';

@Injectable()
export class SyncAuditService {
  private readonly logger = new Logger(SyncAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordOutcome(params: {
    userId: string;
    deviceId: string | null;
    requestId?: string | null;
    op: SyncOp;
    existing: ExistingRecord | null;
    outcome: ProcessOutcome;
  }): Promise<void> {
    const { userId, deviceId, requestId, op, existing, outcome } = params;

    try {
      if (outcome.status === 'applied' && outcome.conflictType) {
        await this.prisma.syncConflictLog.create({
          data: {
            userId,
            entityType: op.entityType,
            entityId: op.entityId,
            conflictType: outcome.conflictType,
            strategy: outcome.strategy,
            originalPayload: (existing?.payload ?? {}) as Prisma.InputJsonValue,
            incomingPayload: op.payload as Prisma.InputJsonValue,
            resolvedPayload: outcome.payload as Prisma.InputJsonValue,
            originalVersion: existing?.version ?? 0,
            incomingVersion: op.clientVersion,
            resolvedVersion: outcome.version,
            deviceId: deviceId ?? undefined,
            requestId: requestId ?? op.requestId ?? undefined,
            resolved: true,
          },
        });
      } else if (outcome.status === 'conflict') {
        await this.prisma.syncConflictLog.create({
          data: {
            userId,
            entityType: op.entityType,
            entityId: op.entityId,
            conflictType: outcome.conflictType,
            strategy: outcome.strategy,
            originalPayload: outcome.serverPayload as Prisma.InputJsonValue,
            incomingPayload: outcome.clientPayload as Prisma.InputJsonValue,
            resolvedPayload: Prisma.DbNull,
            originalVersion: outcome.serverVersion,
            incomingVersion: outcome.clientVersion,
            resolvedVersion: null,
            deviceId: deviceId ?? undefined,
            requestId: requestId ?? op.requestId ?? undefined,
            resolved: false,
          },
        });
      }

      if (outcome.status === 'applied' && outcome.merged && existing) {
        await this.prisma.syncMergeHistory.create({
          data: {
            userId,
            entityType: op.entityType,
            entityId: op.entityId,
            strategy: outcome.strategy,
            beforePayload: existing.payload as Prisma.InputJsonValue,
            afterPayload: outcome.payload as Prisma.InputJsonValue,
            deviceId: deviceId ?? undefined,
            requestId: requestId ?? op.requestId ?? undefined,
          },
        });
        this.logger.log({
          msg: 'Merge completed',
          entityType: op.entityType,
          entityId: op.entityId,
          strategy: outcome.strategy,
        });
      }

      const eventType =
        outcome.status === 'duplicate'
          ? outcome.reason === 'replay'
            ? 'sync_replay'
            : 'duplicate_ignored'
          : outcome.status === 'conflict'
            ? 'conflict_unresolved'
            : outcome.merged
              ? 'merge_applied'
              : outcome.conflictType
                ? 'conflict_resolved'
                : 'applied';

      await this.prisma.syncHistoryEvent.create({
        data: {
          userId,
          entityType: op.entityType,
          entityId: op.entityId,
          operation: op.operation,
          eventType,
          version:
            outcome.status === 'conflict'
              ? outcome.serverVersion
              : outcome.version,
          deviceId: deviceId ?? undefined,
          requestId: requestId ?? op.requestId ?? undefined,
          metadata: {
            status: outcome.status,
            strategy:
              outcome.status === 'applied' || outcome.status === 'conflict'
                ? outcome.strategy
                : undefined,
            conflictType:
              outcome.status === 'applied' || outcome.status === 'conflict'
                ? outcome.conflictType
                : undefined,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      // Audit must not fail the sync path
      this.logger.error({
        msg: 'Audit write failed',
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logConflictDetected(
    entityType: string,
    entityId: string,
    conflictType: ConflictType,
    strategy: ConflictStrategy,
  ) {
    this.logger.warn({
      msg: 'Conflict detected',
      entityType,
      entityId,
      conflictType,
      strategy,
    });
  }
}
