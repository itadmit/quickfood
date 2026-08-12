-- A DelivApp create can succeed without returning a BarcodeId, which used to
-- leave no trace at all. Backfill existing rows that do have a barcode so the
-- new flag is consistent for orders dispatched before this column existed.
ALTER TABLE "orders" ADD COLUMN "deliv_app_dispatched_at" TIMESTAMP(3);
UPDATE "orders" SET "deliv_app_dispatched_at" = "created_at" WHERE "deliv_app_barcode_id" IS NOT NULL;
