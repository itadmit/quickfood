-- Default reviews channel for new tenants is now email (Resend free tier),
-- not "off". Existing tenants keep whatever they had - no data backfill.
ALTER TABLE "tenants" ALTER COLUMN "reviews_channel" SET DEFAULT 'email';
