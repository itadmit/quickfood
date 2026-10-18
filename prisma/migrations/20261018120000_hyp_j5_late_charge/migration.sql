-- Hyp J5 "late charge" (deferred capture): authorize the card now, capture the
-- money later from the dashboard. Adds the held-but-not-captured states.
--
--   PaymentStatus.authorized            -> Order holds a J5 reservation, not paid yet.
--   PaymentTransactionStatus.authorized -> the J5 auth record we capture against later.
--
-- The per-store toggle itself lives in PaymentProviderConfig.settings
-- (settings.deferredCapture) - no column needed.

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'authorized';
ALTER TYPE "PaymentTransactionStatus" ADD VALUE IF NOT EXISTS 'authorized';
