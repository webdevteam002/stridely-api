/**
 * Backward-compatible re-exports. Prefer ConflictResolverService.
 */
export {
  ConflictResolverService as ConflictResolverAdapter,
  ConflictResolverService,
  type ConflictStrategy,
  type SyncOp,
  type ExistingRecord,
  type ProcessOutcome,
  type ConflictType,
} from './conflict-resolver.service';
