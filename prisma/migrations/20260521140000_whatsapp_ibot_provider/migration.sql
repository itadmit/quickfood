-- Add WhatsApp (iBot Chat) as a second messaging provider alongside SMS.
-- Per-tenant credentials (BYO instance) - each merchant connects their own
-- iBot account. Credits are shared with SMS (same per-message price).

-- 1. Extend the ReviewChannel enum with "whatsapp".
ALTER TYPE "ReviewChannel" ADD VALUE IF NOT EXISTS 'whatsapp';

-- 2. Tenant: per-merchant iBot credentials. Nullable - WhatsApp is off
-- until both columns are populated.
ALTER TABLE "tenants"
    ADD COLUMN "whatsapp_token" TEXT,
    ADD COLUMN "whatsapp_instance_id" TEXT;

-- 3. SmsLog: distinguish sms vs whatsapp rows in the unified history. Default
-- "sms" so all existing rows backfill correctly without an UPDATE.
ALTER TABLE "sms_logs"
    ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'sms';
