-- Add CardCom as a second card-processing provider alongside Grow.
-- Per-tenant credentials (TerminalNumber + ApiName + ApiPassword) live in
-- the existing payment_provider_configs.credentials JSONB - no new columns.
-- The existing kiosk_pending_checkouts.grow_process_id column is reused
-- verbatim to hold CardCom's LowProfileId (nullable string, name is cosmetic).

-- Postgres cannot add an enum value inside a transaction that also uses it,
-- so this stands alone. IF NOT EXISTS keeps re-runs idempotent.
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'cardcom';
