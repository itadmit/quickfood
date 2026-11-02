ALTER TABLE "orders"
  ADD COLUMN "purchase_pixel_claim" TEXT,
  ADD COLUMN "purchase_pixel_claimed_at" TIMESTAMP(3),
  ADD COLUMN "purchase_pixel_reported_at" TIMESTAMP(3);
