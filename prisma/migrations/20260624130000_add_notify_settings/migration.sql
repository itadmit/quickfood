-- Per-event transactional notification settings (confirmed/ready/on_the_way/delivered).
ALTER TABLE "tenants" ADD COLUMN "notify_settings" JSONB NOT NULL DEFAULT '{}';
