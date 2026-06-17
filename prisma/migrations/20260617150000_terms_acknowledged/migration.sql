-- Merchant explicit approval of their storefront terms (content-liability
-- acknowledgement). The dashboard hard-blocks until this is set.
ALTER TABLE "tenants" ADD COLUMN "terms_acknowledged_at" TIMESTAMP(3);
