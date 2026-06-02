-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "kiosk_string_overrides" JSONB NOT NULL DEFAULT '{}';
