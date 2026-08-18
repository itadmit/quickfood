-- Weight-based pricing: a menu item can be sold by weight (price per kg,
-- customer enters grams). Order lines carry the ordered weight in grams.
ALTER TABLE "menu_items" ADD COLUMN "pricing_mode" TEXT NOT NULL DEFAULT 'fixed';
ALTER TABLE "menu_items" ADD COLUMN "price_per_kg" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "weight_grams" INTEGER;
