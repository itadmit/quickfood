-- Merchant-editable storefront legal terms (תקנון) + per-order consent proof.
-- Required for Grow payment-processor compliance.
ALTER TABLE "tenants" ADD COLUMN "terms_text" TEXT;
ALTER TABLE "orders" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
