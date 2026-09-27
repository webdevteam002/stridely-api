import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SyncController } from './controllers/sync.controller';
import { BatchConflictProcessor } from './services/batch-conflict.processor';
import { BatchProcessor } from './services/batch.processor';
import { ConflictResolverService } from './services/conflict-resolver.service';
import { MergeEngine } from './services/merge.engine';
import { SyncAuditService } from './services/sync-audit.service';
import { SyncProcessor } from './services/sync.processor';
import { SyncService } from './services/sync.service';
import { VersionValidator } from './services/version.validator';

@Module({
  imports: [AuthModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncProcessor,
    BatchProcessor,
    BatchConflictProcessor,
    MergeEngine,
    VersionValidator,
    ConflictResolverService,
    SyncAuditService,
  ],
  exports: [SyncService, ConflictResolverService, MergeEngine],
})
export class SyncModule {}
