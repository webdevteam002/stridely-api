/**
 * Prisma model aliases used as domain entity markers.
 * Business logic must not live here — schema is the source of truth.
 */
export type {
  User,
  Profile,
  Goal,
  GoalHistory,
  MovementSession,
  DailyActivity,
  Achievement,
  Preference,
  SyncJob,
  Device,
  AuditLog,
  RefreshToken,
  LoginAudit,
  PasswordResetToken,
  EmailVerificationToken,
  SyncRecord,
  SyncCursor,
  SyncIdempotencyKey,
} from '@prisma/client';
