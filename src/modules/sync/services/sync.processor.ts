import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  ConflictResolverService,
  ProcessOutcome,
  SyncOp,
} from './conflict-resolver.service';
import { SyncAuditService } from './sync-audit.service';

@Injectable()
export class SyncProcessor {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conflicts: ConflictResolverService,
    private readonly audit: SyncAuditService,
  ) {}

  async processOp(
    userId: string,
    deviceId: string | null,
    op: SyncOp,
    requestId?: string | null,
  ): Promise<ProcessOutcome & { entityType: string; entityId: string }> {
    const existing = await this.prisma.syncRecord.findUnique({
      where: {
        userId_entityType_entityId: {
          userId,
          entityType: op.entityType,
          entityId: op.entityId,
        },
      },
    });

    const existingView = existing
      ? {
          version: existing.version,
          payload: existing.payload as Record<string, unknown>,
          updatedAt: existing.updatedAt,
          deletedAt: existing.deletedAt,
          deviceId: existing.deviceId,
        }
      : null;

    const outcome = this.conflicts.evaluate(
      {
        ...op,
        deviceId: op.deviceId ?? deviceId,
        requestId: op.requestId ?? requestId ?? null,
      },
      existingView,
    );

    if (outcome.status === 'applied') {
      const isDelete =
        op.operation === 'delete' || op.operation === 'soft_delete';
      const deletedAt = isDelete ? new Date() : null;
      const writeAt = op.clientUpdatedAt
        ? new Date(op.clientUpdatedAt)
        : new Date();

      await this.prisma.syncRecord.upsert({
        where: {
          userId_entityType_entityId: {
            userId,
            entityType: op.entityType,
            entityId: op.entityId,
          },
        },
        create: {
          userId,
          entityType: op.entityType,
          entityId: op.entityId,
          payload: outcome.payload as Prisma.InputJsonValue,
          version: outcome.version,
          deviceId,
          deletedAt,
          updatedAt: writeAt,
        },
        update: {
          payload: outcome.payload as Prisma.InputJsonValue,
          version: outcome.version,
          deviceId,
          deletedAt,
          updatedAt: writeAt,
        },
      });
      this.logger.log({
        msg: 'Sync op applied',
        entityType: op.entityType,
        entityId: op.entityId,
        version: outcome.version,
        strategy: outcome.strategy,
        conflictType: outcome.conflictType,
      });
    } else if (outcome.status === 'conflict') {
      this.audit.logConflictDetected(
        op.entityType,
        op.entityId,
        outcome.conflictType,
        outcome.strategy,
      );
    } else if (outcome.status === 'duplicate') {
      this.logger.log({
        msg: 'Duplicate ignored',
        reason: outcome.reason,
        entityType: op.entityType,
        entityId: op.entityId,
      });
    }

    await this.audit.recordOutcome({
      userId,
      deviceId,
      requestId,
      op,
      existing: existingView,
      outcome,
    });

    return {
      ...outcome,
      entityType: op.entityType,
      entityId: op.entityId,
    };
  }
}
