-- Per-store Facebook/Meta pixel id on the tenant.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "facebook_pixel_id" VARCHAR(32);

-- First-party add-to-cart counter (one row per tenant per Israel-day).
CREATE TABLE IF NOT EXISTS "storefront_cart_adds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "adds" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_cart_adds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "storefront_cart_adds_tenant_id_day_key" ON "storefront_cart_adds" ("tenant_id", "day");
CREATE INDEX IF NOT EXISTS "storefront_cart_adds_tenant_id_day_idx" ON "storefront_cart_adds" ("tenant_id", "day");

DO $$ BEGIN
    ALTER TABLE "storefront_cart_adds" ADD CONSTRAINT "storefront_cart_adds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
