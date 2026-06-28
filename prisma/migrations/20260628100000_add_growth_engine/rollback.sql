-- ROLLBACK for 20260628100000_add_growth_engine
-- Purely additive migration → rollback just drops the new objects.
-- Run manually against the DB if you need to revert. Order matters (FKs first
-- via CASCADE on the tables, enums + columns last). No existing data touched.

DROP TABLE IF EXISTS "qr_scans" CASCADE;
DROP TABLE IF EXISTS "customer_attributions" CASCADE;
DROP TABLE IF EXISTS "growth_tasks" CASCADE;
DROP TABLE IF EXISTS "source_settings" CASCADE;
DROP TABLE IF EXISTS "qr_campaigns" CASCADE;

DROP TYPE IF EXISTS "FirstTouchType";
DROP TYPE IF EXISTS "AttributionCategory";

ALTER TABLE "tenants" DROP COLUMN IF EXISTS "growth_settings";
ALTER TABLE "tenants" DROP COLUMN IF EXISTS "country";

-- Also remove the migration bookkeeping row so Prisma doesn't think it's applied:
-- DELETE FROM "_prisma_migrations" WHERE migration_name = '20260628100000_add_growth_engine';
