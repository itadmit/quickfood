-- Third half-pricing mode: explicit per-option half price (X) vs whole (Y).
-- Group flag wins over split_price; option half_price_delta falls back to
-- price_delta when NULL.
ALTER TABLE "item_option_groups" ADD COLUMN "custom_half_price" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "modifier_sets" ADD COLUMN "custom_half_price" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "item_options" ADD COLUMN "half_price_delta" INTEGER;
ALTER TABLE "modifier_set_options" ADD COLUMN "half_price_delta" INTEGER;
