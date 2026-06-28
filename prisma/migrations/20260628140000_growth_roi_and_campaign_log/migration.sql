-- Growth ROI (QR campaign cost) + campaign send log. Purely additive.

-- AlterTable
ALTER TABLE "qr_campaigns" ADD COLUMN     "cost" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "growth_campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "segment" VARCHAR(40) NOT NULL,
    "channel" VARCHAR(12) NOT NULL,
    "subject" VARCHAR(200),
    "body" VARCHAR(2000) NOT NULL,
    "recipients" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "growth_campaigns_tenant_id_created_at_idx" ON "growth_campaigns"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "growth_campaigns" ADD CONSTRAINT "growth_campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
