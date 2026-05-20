-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "image_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "link_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_is_active_updated_at_idx" ON "campaigns"("tenant_id", "is_active", "updated_at" DESC);

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
