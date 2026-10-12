-- Add Hyp (formerly YaadPay / Yaad Sarig) as a third card-processing provider
-- alongside Grow and CardCom. Per-tenant credentials (Masof + PassP + KEY)
-- live in the existing payment_provider_configs.credentials JSONB - no new
-- columns. The existing kiosk_pending_checkouts.grow_process_id column is
-- reused verbatim to hold Hyp's Order reference (name is cosmetic).

-- Postgres cannot add an enum value inside a transaction that also uses it,
-- so this stands alone. IF NOT EXISTS keeps re-runs idempotent.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'hyp';
