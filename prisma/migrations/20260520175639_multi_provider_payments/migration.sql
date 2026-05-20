-- Multi-provider payments: tenants can accept cash AND credit (Grow) at the
-- same time; the customer chooses at checkout instead of the merchant picking
-- a single default provider.

-- 1) New column. Default true so any tenant currently set to accept cash
--    keeps accepting cash without intervention.
ALTER TABLE "tenants" ADD COLUMN "accepts_cash" BOOLEAN NOT NULL DEFAULT true;

-- 2) Backfill from the old enum:
--    - Old 'cash' tenants → acceptsCash stays true (default already set it).
--    - Old 'grow' tenants → acceptsCash = false (they were not accepting cash
--      under the single-provider model). If the merchant wants both, they
--      can toggle it on in the settings UI.
UPDATE "tenants" SET "accepts_cash" = false WHERE "payment_provider" = 'grow';

-- 3) Drop the old single-provider column. The PaymentProvider enum stays —
--    it's still used by payment_provider_configs / pending_payments /
--    payment_transactions to differentiate provider types.
ALTER TABLE "tenants" DROP COLUMN "payment_provider";
