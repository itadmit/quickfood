-- Customer loyalty club.

-- Per-tenant program config (points rate, tier thresholds, join-form copy,
-- storefront toggles). Empty default; resolveLoyaltyConfig fills defaults.
ALTER TABLE "tenants" ADD COLUMN "loyalty_config" JSONB NOT NULL DEFAULT '{}';

-- How a member joined the club.
CREATE TYPE "LoyaltyJoinSource" AS ENUM ('checkout', 'popup', 'manual');

-- Per-tenant membership rows. Points/tier are derived from order totals at
-- read time, never stored.
CREATE TABLE "loyalty_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "join_source" "LoyaltyJoinSource" NOT NULL DEFAULT 'checkout',
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "loyalty_members_tenant_id_customer_id_key" ON "loyalty_members"("tenant_id", "customer_id");
CREATE INDEX "loyalty_members_tenant_id_joined_at_idx" ON "loyalty_members"("tenant_id", "joined_at" DESC);

ALTER TABLE "loyalty_members" ADD CONSTRAINT "loyalty_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_members" ADD CONSTRAINT "loyalty_members_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
