ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "delivery_providers" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_provider" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_provider_dispatched_at" TIMESTAMP(3);
