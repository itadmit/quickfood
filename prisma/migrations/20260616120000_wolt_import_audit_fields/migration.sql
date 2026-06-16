-- Audit trail for Wolt imports: who committed it and which terms version
-- was in effect. Stamped server-side at commit time.
ALTER TABLE "wolt_imports" ADD COLUMN "imported_by_user_id" TEXT;
ALTER TABLE "wolt_imports" ADD COLUMN "terms_version" TEXT;
