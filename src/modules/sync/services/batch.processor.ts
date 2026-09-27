import { Injectable, Logger } from '@nestjs/common';
import { SyncOp } from './conflict-resolver.service';
import { BatchConflictProcessor } from './batch-conflict.processor';

export type BatchResult = {
  applied: Array<{
    entityType: string;
    entityId: string;
    version: number;
    status: 'applied' | 'duplicate';
  }>;
  conflicts: Array<{
    entityType: string;
    entityId: string;
    clientVersion: number;
    serverVersion: number;
    clientPayload: Record<string, unknown>;
    serverPayload: Record<string, unknown>;
    reason: string;
  }>;
};

@Injectable()
export class BatchProcessor {
  private readonly logger = new Logger(BatchProcessor.name);

  constructor(private readonly batchConflicts: BatchConflictProcessor) {}

  async processBatch(
    userId: string,
    deviceId: string | null,
    operations: SyncOp[],
    requestId?: string | null,
  ): Promise<BatchResult> {
    this.logger.log({
      msg: 'Batch uploaded',
      userId,
      count: operations.length,
    });
    return this.batchConflicts.processBatch(
      userId,
      deviceId,
      operations,
      requestId,
    );
  }
}
