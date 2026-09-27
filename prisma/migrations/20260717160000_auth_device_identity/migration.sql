-- AlterTable users: auth fields + optional email for anonymous
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "users" RENAME COLUMN "displayName" TO "display_name";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "anonymous_key" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "upgraded_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "merged_into_user_id" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "users_anonymous_key_key" ON "users"("anonymous_key");
CREATE INDEX IF NOT EXISTS "users_account_type_idx" ON "users"("account_type");

-- AlterTable devices
DROP INDEX IF EXISTS "devices_device_id_key";
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "device_name" TEXT;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "last_seen" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "trusted" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "devices_user_id_device_id_key" ON "devices"("user_id", "device_id");
CREATE INDEX IF NOT EXISTS "devices_last_seen_idx" ON "devices"("last_seen");

-- CreateTable refresh_tokens
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_row_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "family_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "replaced_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_device_row_id_idx" ON "refresh_tokens"("device_row_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_user_id_fkey";
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "refresh_tokens_device_row_id_fkey";
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_device_row_id_fkey" FOREIGN KEY ("device_row_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable login_audits
CREATE TABLE IF NOT EXISTS "login_audits" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "device_row_id" UUID,
    "event" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "login_audits_user_id_created_at_idx" ON "login_audits"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "login_audits_event_idx" ON "login_audits"("event");

ALTER TABLE "login_audits" DROP CONSTRAINT IF EXISTS "login_audits_user_id_fkey";
ALTER TABLE "login_audits" ADD CONSTRAINT "login_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "login_audits" DROP CONSTRAINT IF EXISTS "login_audits_device_row_id_fkey";
ALTER TABLE "login_audits" ADD CONSTRAINT "login_audits_device_row_id_fkey" FOREIGN KEY ("device_row_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable password_reset_tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

ALTER TABLE "password_reset_tokens" DROP CONSTRAINT IF EXISTS "password_reset_tokens_user_id_fkey";
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable email_verification_tokens
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");

ALTER TABLE "email_verification_tokens" DROP CONSTRAINT IF EXISTS "email_verification_tokens_user_id_fkey";
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
