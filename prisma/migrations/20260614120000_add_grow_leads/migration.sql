-- CreateTable
CREATE TABLE "grow_leads" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "business_number" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "website" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "airtable_row_id" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grow_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grow_leads_tenant_id_created_at_idx" ON "grow_leads"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "grow_leads" ADD CONSTRAINT "grow_leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
