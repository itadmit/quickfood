-- Allow EmailLog rows that aren't tied to a tenant (e.g. system test emails,
-- platform-level transactional sends).

ALTER TABLE "email_logs" DROP CONSTRAINT IF EXISTS "email_logs_tenant_id_fkey";

ALTER TABLE "email_logs" ALTER COLUMN "tenant_id" DROP NOT NULL;

ALTER TABLE "email_logs"
    ADD CONSTRAINT "email_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
