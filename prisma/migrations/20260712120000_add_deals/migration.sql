ALTER TYPE "OrderItemSource" ADD VALUE IF NOT EXISTS 'deal';

CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT,
    "fixed_price" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "category_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deal_slots" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "deal_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deal_slot_choices" (
    "slot_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "deal_slot_choices_pkey" PRIMARY KEY ("slot_id","item_id")
);

CREATE INDEX "deals_tenant_id_active_position_idx" ON "deals"("tenant_id", "active", "position");
CREATE INDEX "deal_slots_deal_id_idx" ON "deal_slots"("deal_id");

ALTER TABLE "deals" ADD CONSTRAINT "deals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "deal_slots" ADD CONSTRAINT "deal_slots_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_slot_choices" ADD CONSTRAINT "deal_slot_choices_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "deal_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_slot_choices" ADD CONSTRAINT "deal_slot_choices_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
