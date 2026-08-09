ALTER TABLE "tenants" ADD COLUMN "deliv_app_config" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "orders" ADD COLUMN "deliv_app_barcode_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliv_app_status" INTEGER;
