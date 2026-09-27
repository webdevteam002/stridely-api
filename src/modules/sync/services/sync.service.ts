import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../../database/prisma.service';
import { BatchProcessor } from './batch.processor';
import { SyncOp } from './conflict-resolver.service';

const MAX_BATCH = 100;

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly batchProcessor: BatchProcessor,
  ) {}

  async upload(params: {
    userId: string;
    deviceId: string;
    operations: SyncOp[];
    requestId?: string | null;
  }) {
    this.logger.log({ msg: 'Sync started', userId: params.userId, phase: 'upload' });
    this.assertBatchSize(params.operations);

    if (params.requestId) {
      const cached = await this.loadIdempotent(
        params.userId,
        params.requestId,
      );
      if (cached) {
        this.logger.log({ msg: 'Duplicate upload ignored', requestId: params.requestId });
        return cached;
      }
    }

    try {
      const result = await this.batchProcessor.processBatch(
        params.userId,
        params.deviceId,
        params.operations,
        params.requestId,
      );
      const body = {
        ...result,
        cursor: await this.touchCursor(params.userId, params.deviceId),
      };
      if (params.requestId) {
        await this.saveIdempotent(params.userId, params.requestId, body);
      }
      this.logger.log({
        msg: 'Sync completed',
        phase: 'upload',
        applied: result.applied.length,
        conflicts: result.conflicts.length,
      });
      return body;
    } catch (err) {
      this.logger.error({
        msg: 'Sync failed',
        phase: 'upload',
        err: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async download(params: {
    userId: string;
    deviceId: string;
    cursor?: string | null;
    limit?: number;
  }) {
    this.logger.log({ msg: 'Sync started', userId: params.userId, phase: 'download' });
    const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);
    const since = params.cursor ? this.parseCursor(params.cursor) : null;

    const records = await this.prisma.syncRecord.findMany({
      where: {
        userId: params.userId,
        ...(since
          ? { updatedAt: { gt: since } }
          : {}),
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    const changes = records.map((r) => ({
      entityType: r.entityType,
      entityId: r.entityId,
      operation: r.deletedAt ? 'delete' : 'upsert',
      version: r.version,
      payload: r.payload,
      updatedAt: r.updatedAt.toISOString(),
      deletedAt: r.deletedAt?.toISOString() ?? null,
    }));

    const nextCursor =
      records.length > 0
        ? this.encodeCursor(records[records.length - 1].updatedAt)
        : params.cursor ?? this.encodeCursor(new Date(0));

    await this.prisma.syncCursor.upsert({
      where: {
        userId_deviceId: {
          userId: params.userId,
          deviceId: params.deviceId,
        },
      },
      create: {
        userId: params.userId,
        deviceId: params.deviceId,
        cursor: nextCursor,
        lastSyncAt: new Date(),
      },
      update: {
        cursor: nextCursor,
        lastSyncAt: new Date(),
      },
    });

    this.logger.log({
      msg: 'Sync completed',
      phase: 'download',
      count: changes.length,
    });

    return {
      changes,
      cursor: nextCursor,
      hasMore: records.length === limit,
    };
  }

  async batch(params: {
    userId: string;
    deviceId: string;
    operations: SyncOp[];
    cursor?: string | null;
    requestId?: string | null;
  }) {
    const upload = await this.upload({
      userId: params.userId,
      deviceId: params.deviceId,
      operations: params.operations,
      requestId: params.requestId,
    });
    const download = await this.download({
      userId: params.userId,
      deviceId: params.deviceId,
      cursor: params.cursor,
    });
    return { upload, download };
  }

  async status(userId: string, deviceId: string) {
    const pendingJobs = await this.prisma.syncJob.count({
      where: {
        userId,
        jobStatus: { in: ['pending', 'in_progress'] },
        deletedAt: null,
      },
    });
    const failedJobs = await this.prisma.syncJob.count({
      where: { userId, jobStatus: 'failed', deletedAt: null },
    });
    const cursor = await this.prisma.syncCursor.findUnique({
      where: {
        userId_deviceId: { userId, deviceId },
      },
    });
    const recordCount = await this.prisma.syncRecord.count({
      where: { userId, deletedAt: null },
    });

    return {
      engineStatus: pendingJobs > 0 ? 'syncing' : 'idle',
      pendingCount: pendingJobs,
      failedCount: failedJobs,
      recordCount,
      lastSyncAt: cursor?.lastSyncAt?.toISOString() ?? null,
      cursor: cursor?.cursor ?? null,
      paused: false,
    };
  }

  async ack(params: {
    userId: string;
    deviceId: string;
    cursor: string;
    changeIds?: string[];
  }) {
    await this.prisma.syncCursor.upsert({
      where: {
        userId_deviceId: {
          userId: params.userId,
          deviceId: params.deviceId,
        },
      },
      create: {
        userId: params.userId,
        deviceId: params.deviceId,
        cursor: params.cursor,
        lastSyncAt: new Date(),
      },
      update: {
        cursor: params.cursor,
        lastSyncAt: new Date(),
      },
    });
    return { ok: true, cursor: params.cursor };
  }

  private assertBatchSize(ops: SyncOp[]) {
    if (!ops.length) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: 'operations must not be empty',
      });
    }
    if (ops.length > MAX_BATCH) {
      throw new BadRequestException({
        code: 'INVALID_PAYLOAD',
        message: `operations max is ${MAX_BATCH}`,
      });
    }
  }

  private encodeCursor(date: Date): string {
    return Buffer.from(date.toISOString(), 'utf8').toString('base64url');
  }

  private parseCursor(cursor: string): Date | null {
    try {
      const raw = Buffer.from(cursor, 'base64url').toString('utf8');
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }

  private async touchCursor(userId: string, deviceId: string): Promise<string> {
    const cursor = this.encodeCursor(new Date());
    await this.prisma.syncCursor.upsert({
      where: { userId_deviceId: { userId, deviceId } },
      create: { userId, deviceId, cursor, lastSyncAt: new Date() },
      update: { cursor, lastSyncAt: new Date() },
    });
    return cursor;
  }

  private async loadIdempotent(userId: string, requestId: string) {
    const row = await this.prisma.syncIdempotencyKey.findUnique({
      where: { userId_requestId: { userId, requestId } },
    });
    if (!row || row.expiresAt < new Date()) return null;
    return row.responseBody as Record<string, unknown> | null;
  }

  private async saveIdempotent(
    userId: string,
    requestId: string,
    body: unknown,
  ) {
    const hash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.syncIdempotencyKey.upsert({
      where: { userId_requestId: { userId, requestId } },
      create: {
        userId,
        requestId,
        responseHash: hash,
        responseBody: body as Prisma.InputJsonValue,
        expiresAt,
      },
      update: {
        responseHash: hash,
        responseBody: body as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  }
}
