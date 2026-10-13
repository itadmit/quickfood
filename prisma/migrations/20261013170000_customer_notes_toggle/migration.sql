-- Per-store toggle for the "הערה למסעדה" free-text note card in checkout.
-- When false the note textarea is hidden from the storefront checkout.
-- Default true keeps the existing behaviour.

ALTER TABLE "tenants" ADD COLUMN "customer_notes_enabled" BOOLEAN NOT NULL DEFAULT true;
