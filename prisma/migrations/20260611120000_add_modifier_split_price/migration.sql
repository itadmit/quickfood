-- Per-group / per-set flag: when a half/half placement should also halve the
-- topping's price. Default false = a topping costs its full price whether
-- placed on a half or the whole pie.
ALTER TABLE "item_option_groups" ADD COLUMN "split_price" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "modifier_sets" ADD COLUMN "split_price" BOOLEAN NOT NULL DEFAULT false;
