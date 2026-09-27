-- CreateSchema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_name" VARCHAR(40),
    "gender" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "height_cm" DOUBLE PRECISION NOT NULL,
    "weight_kg" DOUBLE PRECISION NOT NULL,
    "unit_system" TEXT NOT NULL DEFAULT 'metric',
    "stride_length_cm" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'daily_steps',
    "target_value" INTEGER NOT NULL,
    "recommended_value" INTEGER,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "effective_from" DATE,
    "effective_to" DATE,
    "device_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "goal_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "goal_type" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "final_value" DOUBLE PRECISION NOT NULL,
    "final_status" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL,
    "day_key" CHAR(10),
    "device_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "goal_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "movement_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "day_key" CHAR(10) NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL,
    "ended_at" TIMESTAMPTZ(3),
    "steps" INTEGER NOT NULL DEFAULT 0,
    "distance_meters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calories_kcal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activity_type" TEXT,
    "device_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "movement_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "daily_activities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day_key" CHAR(10) NOT NULL,
    "timezone_name" TEXT,
    "timezone_offset_minutes" INTEGER,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "distance_meters" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calories_kcal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "walking_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "running_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "active_minutes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "average_pace_sec_per_km" DOUBLE PRECISION,
    "average_speed_mps" DOUBLE PRECISION,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "session_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "device_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "daily_activities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "achievements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "achievement_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unlocked_at" TIMESTAMPTZ(3),
    "claimed_at" TIMESTAMPTZ(3),
    "device_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "unit_system" TEXT NOT NULL DEFAULT 'metric',
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_reminder_local_time" VARCHAR(5) NOT NULL DEFAULT '09:00',
    "theme_mode" TEXT NOT NULL DEFAULT 'system',
    "analytics_opt_in" BOOLEAN NOT NULL DEFAULT true,
    "privacy_mode" BOOLEAN NOT NULL DEFAULT false,
    "demo_mode" BOOLEAN NOT NULL DEFAULT false,
    "tracking_enabled" BOOLEAN NOT NULL DEFAULT true,
    "reduce_motion" BOOLEAN NOT NULL DEFAULT false,
    "large_text" BOOLEAN NOT NULL DEFAULT false,
    "device_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "job_status" TEXT NOT NULL DEFAULT 'pending',
    "last_error" TEXT,
    "next_attempt_at" TIMESTAMPTZ(3),
    "device_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "platform" TEXT,
    "app_version" TEXT,
    "push_token" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "request_id" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Indexes & uniques
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX "users_updated_at_idx" ON "users"("updated_at");

CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");
CREATE INDEX "profiles_updated_at_idx" ON "profiles"("updated_at");

CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");
CREATE INDEX "goals_user_id_type_deleted_at_idx" ON "goals"("user_id", "type", "deleted_at");
CREATE INDEX "goals_updated_at_idx" ON "goals"("updated_at");

CREATE INDEX "goal_history_user_id_recorded_at_idx" ON "goal_history"("user_id", "recorded_at");
CREATE INDEX "goal_history_goal_id_idx" ON "goal_history"("goal_id");
CREATE INDEX "goal_history_day_key_idx" ON "goal_history"("day_key");

CREATE UNIQUE INDEX "movement_sessions_session_id_key" ON "movement_sessions"("session_id");
CREATE INDEX "movement_sessions_user_id_day_key_idx" ON "movement_sessions"("user_id", "day_key");
CREATE INDEX "movement_sessions_user_id_started_at_idx" ON "movement_sessions"("user_id", "started_at");
CREATE INDEX "movement_sessions_updated_at_idx" ON "movement_sessions"("updated_at");

CREATE UNIQUE INDEX "daily_activities_user_id_day_key_key" ON "daily_activities"("user_id", "day_key");
CREATE INDEX "daily_activities_user_id_day_key_idx" ON "daily_activities"("user_id", "day_key");
CREATE INDEX "daily_activities_updated_at_idx" ON "daily_activities"("updated_at");

CREATE UNIQUE INDEX "achievements_user_id_achievement_key_key" ON "achievements"("user_id", "achievement_key");
CREATE INDEX "achievements_user_id_status_idx" ON "achievements"("user_id", "status");
CREATE INDEX "achievements_updated_at_idx" ON "achievements"("updated_at");

CREATE UNIQUE INDEX "preferences_user_id_key" ON "preferences"("user_id");

CREATE UNIQUE INDEX "sync_jobs_job_id_key" ON "sync_jobs"("job_id");
CREATE INDEX "sync_jobs_user_id_job_status_idx" ON "sync_jobs"("user_id", "job_status");
CREATE INDEX "sync_jobs_next_attempt_at_idx" ON "sync_jobs"("next_attempt_at");
CREATE INDEX "sync_jobs_updated_at_idx" ON "sync_jobs"("updated_at");

CREATE UNIQUE INDEX "devices_device_id_key" ON "devices"("device_id");
CREATE INDEX "devices_user_id_idx" ON "devices"("user_id");

CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE INDEX "audit_logs_resource_resource_id_idx" ON "audit_logs"("resource", "resource_id");
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- Foreign keys
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goal_history" ADD CONSTRAINT "goal_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "goal_history" ADD CONSTRAINT "goal_history_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "movement_sessions" ADD CONSTRAINT "movement_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "daily_activities" ADD CONSTRAINT "daily_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
