# Multi-Device Conflict Resolution & Synchronization (S6-T06)

See the app-level guide: [`../../docs/MULTI_DEVICE_SYNC.md`](../../docs/MULTI_DEVICE_SYNC.md).

Backend components:

| Service | Role |
|---------|------|
| `ConflictResolverService` | Classify + resolve conflicts |
| `MergeEngine` | Field merge / union |
| `VersionValidator` | Version + clock skew checks |
| `BatchConflictProcessor` | Batch collapse + deterministic order |
| `SyncAuditService` | Conflict / merge / history tables |

Entity strategy defaults match Flutter (`preference`/`goal` → LWW, sessions/history → merge, achievements → union).
