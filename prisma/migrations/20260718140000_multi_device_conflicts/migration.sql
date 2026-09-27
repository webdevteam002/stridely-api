-- Multi-device conflict audit tables (S6-T06)

CREATE TABLE IF NOT EXISTS "sync_conflict_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "conflict_type" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "original_payload" JSONB NOT NULL,
    "incoming_payload" JSONB NOT NULL,
    "resolved_payload" JSONB,
    "original_version" INTEGER NOT NULL,
    "incoming_version" INTEGER NOT NULL,
    "resolved_version" INTEGER,
    "device_id" UUID,
    "request_id" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_conflict_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sync_conflict_logs_user_id_created_at_idx"
  ON "sync_conflict_logs"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "sync_conflict_logs_entity_type_entity_id_idx"
  ON "sync_conflict_logs"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "sync_conflict_logs_conflict_type_idx"
  ON "sync_conflict_logs"("conflict_type");

ALTER TABLE "sync_conflict_logs" DROP CONSTRAINT IF EXISTS "sync_conflict_logs_user_id_fkey";
ALTER TABLE "sync_conflict_logs" ADD CONSTRAINT "sync_conflict_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sync_merge_histories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "before_payload" JSONB NOT NULL,
    "after_payload" JSONB NOT NULL,
    "device_id" UUID,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_merge_histories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sync_merge_histories_user_id_created_at_idx"
  ON "sync_merge_histories"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "sync_merge_histories_entity_type_entity_id_idx"
  ON "sync_merge_histories"("entity_type", "entity_id");

ALTER TABLE "sync_merge_histories" DROP CONSTRAINT IF EXISTS "sync_merge_histories_user_id_fkey";
ALTER TABLE "sync_merge_histories" ADD CONSTRAINT "sync_merge_histories_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sync_history_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "device_id" UUID,
    "request_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_history_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sync_history_events_user_id_created_at_idx"
  ON "sync_history_events"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "sync_history_events_event_type_idx"
  ON "sync_history_events"("event_type");

ALTER TABLE "sync_history_events" DROP CONSTRAINT IF EXISTS "sync_history_events_user_id_fkey";
ALTER TABLE "sync_history_events" ADD CONSTRAINT "sync_history_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
