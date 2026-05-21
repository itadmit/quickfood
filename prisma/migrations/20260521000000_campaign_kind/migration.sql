-- CreateEnum
CREATE TYPE "CampaignKind" AS ENUM ('popup', 'banner');

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN "kind" "CampaignKind" NOT NULL DEFAULT 'popup';

-- DropIndex
DROP INDEX "campaigns_tenant_id_is_active_updated_at_idx";

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_kind_is_active_updated_at_idx"
  ON "campaigns"("tenant_id", "kind", "is_active", "updated_at" DESC);
