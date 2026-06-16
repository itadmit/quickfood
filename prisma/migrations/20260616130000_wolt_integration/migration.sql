-- Wolt Marketplace integration: ingest external orders + per-venue OAuth tokens.

-- AlterEnum
ALTER TYPE "OrderItemSource" ADD VALUE 'wolt';

-- AlterEnum
ALTER TYPE "OrderSource" ADD VALUE 'wolt';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "external_id" VARCHAR(64),
ADD COLUMN     "external_source" VARCHAR(20);

-- CreateTable
CREATE TABLE "wolt_connections" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "venue_id" VARCHAR(64) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "last_order_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wolt_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wolt_connections_venue_id_idx" ON "wolt_connections"("venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "wolt_connections_tenant_id_venue_id_key" ON "wolt_connections"("tenant_id", "venue_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_external_source_external_id_key" ON "orders"("tenant_id", "external_source", "external_id");

-- AddForeignKey
ALTER TABLE "wolt_connections" ADD CONSTRAINT "wolt_connections_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
