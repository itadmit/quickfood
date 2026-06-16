-- Per-zone minimum order + free-delivery threshold (shekels).
ALTER TABLE "delivery_zones" ADD COLUMN "min_order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "delivery_zones" ADD COLUMN "free_delivery_above" INTEGER;
