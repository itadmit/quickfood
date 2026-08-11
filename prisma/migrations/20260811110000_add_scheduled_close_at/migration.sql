-- Admin-scheduled storefront close: "עצור מנוי וסגור" sets this to the base
-- subscription's current_period_end. The store stays open until this date, then
-- the daily close-scheduled-tenants job suspends the tenant.
ALTER TABLE "tenants" ADD COLUMN "scheduled_close_at" TIMESTAMP(3);
