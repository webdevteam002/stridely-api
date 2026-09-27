-- Device notification fields + notifications table (S6-T07)

ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "locale" TEXT DEFAULT 'en-US';
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'UTC';
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "notification_preferences" JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "devices_push_token_idx" ON "devices"("push_token");

CREATE TABLE IF NOT EXISTS "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_row_id" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduled_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "read_at" TIMESTAMPTZ(3),
    "failure_reason" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx"
  ON "notifications"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications"("status");
CREATE INDEX IF NOT EXISTS "notifications_type_idx" ON "notifications"("type");
CREATE INDEX IF NOT EXISTS "notifications_scheduled_at_idx" ON "notifications"("scheduled_at");

ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_user_id_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_device_row_id_fkey";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_device_row_id_fkey"
  FOREIGN KEY ("device_row_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
