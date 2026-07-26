-- CreateTable
CREATE TABLE "menu_price_changes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "menu_item_id" UUID NOT NULL,
    "old_price" INTEGER NOT NULL,
    "new_price" INTEGER NOT NULL,
    "batch_id" UUID,
    "source" TEXT NOT NULL,
    "changed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "menu_price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "menu_price_changes_tenant_id_created_at_idx" ON "menu_price_changes"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "menu_price_changes_menu_item_id_created_at_idx" ON "menu_price_changes"("menu_item_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "menu_price_changes" ADD CONSTRAINT "menu_price_changes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
