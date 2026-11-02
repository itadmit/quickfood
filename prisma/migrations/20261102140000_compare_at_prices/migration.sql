ALTER TABLE "menu_items" ADD COLUMN "compare_at_price" INTEGER;
ALTER TABLE "order_items" ADD COLUMN "original_unit_price" INTEGER, ADD COLUMN "original_total_price" INTEGER;
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_compare_at_price_valid" CHECK ("compare_at_price" IS NULL OR ("compare_at_price" > CASE WHEN "pricing_mode" = 'weight' THEN COALESCE("price_per_kg", 0) ELSE "base_price" END));
