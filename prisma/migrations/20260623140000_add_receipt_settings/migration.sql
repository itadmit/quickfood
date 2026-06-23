-- Receipt content toggles (show customer name/phone/options/prices/notes).
ALTER TABLE "tenants" ADD COLUMN "receipt_settings" JSONB NOT NULL DEFAULT '{}';
