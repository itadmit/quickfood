-- Records that the owner saw and accepted the WhatsApp notice at signup.
-- Nullable with no default and no backfill: adding it is a catalog-only
-- change on Postgres, so it does not rewrite the merchant_users table.
ALTER TABLE "merchant_users" ADD COLUMN "whatsapp_opt_in_at" TIMESTAMP(3);
