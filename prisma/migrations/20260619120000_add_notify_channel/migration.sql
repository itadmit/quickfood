-- Per-tenant channel for transactional order notifications (confirmed /
-- ready / on-the-way / delivered), sent in addition to email.
ALTER TABLE "tenants" ADD COLUMN "notify_channel" "ReviewChannel" NOT NULL DEFAULT 'email';
