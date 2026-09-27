-- Sync engine tables (S6-T05)

CREATE TABLE IF NOT EXISTS "sync_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "device_id" UUID,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_records_user_id_entity_type_entity_id_key"
  ON "sync_records"("user_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "sync_records_user_id_updated_at_idx"
  ON "sync_records"("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "sync_records_user_id_entity_type_idx"
  ON "sync_records"("user_id", "entity_type");

ALTER TABLE "sync_records" DROP CONSTRAINT IF EXISTS "sync_records_user_id_fkey";
ALTER TABLE "sync_records" ADD CONSTRAINT "sync_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sync_cursors" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "cursor" TEXT NOT NULL,
    "last_sync_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_cursors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_cursors_user_id_device_id_key"
  ON "sync_cursors"("user_id", "device_id");
CREATE INDEX IF NOT EXISTS "sync_cursors_user_id_idx" ON "sync_cursors"("user_id");

ALTER TABLE "sync_cursors" DROP CONSTRAINT IF EXISTS "sync_cursors_user_id_fkey";
ALTER TABLE "sync_cursors" ADD CONSTRAINT "sync_cursors_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "sync_idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "request_id" TEXT NOT NULL,
    "response_hash" TEXT,
    "response_body" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sync_idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_idempotency_keys_user_id_request_id_key"
  ON "sync_idempotency_keys"("user_id", "request_id");
CREATE INDEX IF NOT EXISTS "sync_idempotency_keys_expires_at_idx"
  ON "sync_idempotency_keys"("expires_at");

ALTER TABLE "sync_idempotency_keys" DROP CONSTRAINT IF EXISTS "sync_idempotency_keys_user_id_fkey";
ALTER TABLE "sync_idempotency_keys" ADD CONSTRAINT "sync_idempotency_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
