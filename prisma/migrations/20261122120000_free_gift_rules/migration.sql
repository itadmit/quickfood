ALTER TYPE "OrderItemSource" ADD VALUE IF NOT EXISTS 'free_gift';

CREATE TABLE IF NOT EXISTS "free_gift_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "min_subtotal" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_gift_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "free_gift_rules_tenant_id_active_idx" ON "free_gift_rules"("tenant_id", "active");

ALTER TABLE "free_gift_rules" ADD CONSTRAINT "free_gift_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "free_gift_rules" ADD CONSTRAINT "free_gift_rules_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
