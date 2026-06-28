-- Growth engine (Direct Customer Engine)
-- CreateEnum
CREATE TYPE "AttributionCategory" AS ENUM ('marketplace', 'social', 'search', 'referral', 'walk_in', 'qr', 'other');

-- CreateEnum
CREATE TYPE "FirstTouchType" AS ENUM ('signup', 'checkout', 'qr', 'loyalty', 'manual');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "country" VARCHAR(2) NOT NULL DEFAULT 'IL',
ADD COLUMN     "growth_settings" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "qr_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" VARCHAR(40) NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "destination_type" VARCHAR(20) NOT NULL DEFAULT 'menu',
    "destination_url" TEXT,
    "landing_template" VARCHAR(40),
    "landing_copy" JSONB,
    "coupon_id" UUID,
    "status" VARCHAR(12) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_attributions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "customer_id" UUID,
    "order_id" UUID,
    "source" VARCHAR(40) NOT NULL,
    "source_label" TEXT NOT NULL,
    "source_category" "AttributionCategory" NOT NULL,
    "first_touch_type" "FirstTouchType" NOT NULL,
    "self_reported" BOOLEAN NOT NULL DEFAULT true,
    "campaign_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_scans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "visitor_id" TEXT,
    "customer_id" UUID,
    "ip_hash" VARCHAR(64),
    "user_agent" VARCHAR(300),
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_tasks" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(400),
    "expected_impact" VARCHAR(200),
    "action_type" VARCHAR(40),
    "action_payload" JSONB,
    "status" VARCHAR(12) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "growth_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_settings" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "country" VARCHAR(2) NOT NULL DEFAULT 'IL',
    "source_key" VARCHAR(40) NOT NULL,
    "source_label" TEXT NOT NULL,
    "source_category" "AttributionCategory" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "source_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qr_campaigns_code_key" ON "qr_campaigns"("code");

-- CreateIndex
CREATE INDEX "qr_campaigns_tenant_id_status_idx" ON "qr_campaigns"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "customer_attributions_tenant_id_created_at_idx" ON "customer_attributions"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "customer_attributions_tenant_id_customer_id_idx" ON "customer_attributions"("tenant_id", "customer_id");

-- CreateIndex
CREATE INDEX "customer_attributions_tenant_id_source_idx" ON "customer_attributions"("tenant_id", "source");

-- CreateIndex
CREATE INDEX "qr_scans_tenant_id_campaign_id_created_at_idx" ON "qr_scans"("tenant_id", "campaign_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "growth_tasks_tenant_id_key_key" ON "growth_tasks"("tenant_id", "key");

-- CreateIndex
CREATE INDEX "growth_tasks_tenant_id_status_idx" ON "growth_tasks"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "source_settings_tenant_id_source_key_key" ON "source_settings"("tenant_id", "source_key");

-- CreateIndex
CREATE INDEX "source_settings_tenant_id_is_active_sort_order_idx" ON "source_settings"("tenant_id", "is_active", "sort_order");

-- AddForeignKey
ALTER TABLE "qr_campaigns" ADD CONSTRAINT "qr_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_attributions" ADD CONSTRAINT "customer_attributions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_attributions" ADD CONSTRAINT "customer_attributions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_attributions" ADD CONSTRAINT "customer_attributions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "qr_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_scans" ADD CONSTRAINT "qr_scans_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "qr_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_tasks" ADD CONSTRAINT "growth_tasks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_settings" ADD CONSTRAINT "source_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
