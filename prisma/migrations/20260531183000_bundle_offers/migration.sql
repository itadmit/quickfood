-- Bundle offers - additive "make it a meal" combos.
--
-- Triggers: which menu items, when present in the cart, fire the
-- offer. Addons: the items the customer gets if they accept. The
-- bundle stays additive (triggers stay in the cart at full price);
-- pricing reconciliation happens at order-create time by adding an
-- Order.discount equal to (sum addon basePrice * qty - bundlePrice).
CREATE TABLE "bundle_offers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "image_url" TEXT,
  "bundle_price" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "position" INTEGER NOT NULL DEFAULT 0,
  "valid_from" TIMESTAMP(3),
  "valid_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bundle_offers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bundle_offers_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "bundle_offers_tenant_id_active_idx"
  ON "bundle_offers" ("tenant_id", "active");

CREATE TABLE "bundle_offer_triggers" (
  "bundle_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  CONSTRAINT "bundle_offer_triggers_pkey" PRIMARY KEY ("bundle_id", "item_id"),
  CONSTRAINT "bundle_offer_triggers_bundle_id_fkey"
    FOREIGN KEY ("bundle_id") REFERENCES "bundle_offers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bundle_offer_triggers_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "menu_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "bundle_offer_addons" (
  "bundle_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "bundle_offer_addons_pkey" PRIMARY KEY ("bundle_id", "item_id"),
  CONSTRAINT "bundle_offer_addons_bundle_id_fkey"
    FOREIGN KEY ("bundle_id") REFERENCES "bundle_offers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bundle_offer_addons_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "menu_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
