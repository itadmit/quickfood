-- Bundle deal: the first `bundle_count` paid selections together cost a flat
-- `bundle_price` (shekels); selections beyond that pay full price. 0 = off.
ALTER TABLE "item_option_groups" ADD COLUMN "bundle_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "item_option_groups" ADD COLUMN "bundle_price" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "modifier_sets" ADD COLUMN "bundle_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "modifier_sets" ADD COLUMN "bundle_price" INTEGER NOT NULL DEFAULT 0;
