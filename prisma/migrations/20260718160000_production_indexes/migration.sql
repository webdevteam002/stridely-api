-- Production hot-path indexes (S6-T08)

CREATE INDEX IF NOT EXISTS "devices_user_id_deleted_at_idx"
  ON "devices"("user_id", "deleted_at");

CREATE INDEX IF NOT EXISTS "devices_user_id_deleted_at_push_token_idx"
  ON "devices"("user_id", "deleted_at", "push_token");

CREATE INDEX IF NOT EXISTS "notifications_user_id_status_idx"
  ON "notifications"("user_id", "status");

CREATE INDEX IF NOT EXISTS "notifications_status_next_retry_at_idx"
  ON "notifications"("status", "next_retry_at");

CREATE INDEX IF NOT EXISTS "sync_records_user_id_deleted_at_idx"
  ON "sync_records"("user_id", "deleted_at");
