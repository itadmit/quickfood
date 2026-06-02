-- New managed-WhatsApp reviews add-on: ₪99/mo + VAT, unlimited sends via the
-- platform iBot account. Adds a channel enum value + a mirror of the
-- subscription id from QuickBilling Hub. Existing rows untouched.
ALTER TYPE "ReviewChannel" ADD VALUE IF NOT EXISTS 'whatsapp_managed';

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "reviews_whatsapp_subscription_id" TEXT;
