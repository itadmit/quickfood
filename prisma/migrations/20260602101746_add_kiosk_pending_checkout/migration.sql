-- CreateTable
CREATE TABLE "kiosk_pending_checkouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cart_data" JSONB NOT NULL,
    "order_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "grow_process_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kiosk_pending_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kiosk_pending_checkouts_tenant_id_status_idx" ON "kiosk_pending_checkouts"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "kiosk_pending_checkouts" ADD CONSTRAINT "kiosk_pending_checkouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
