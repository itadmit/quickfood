-- Per-tenant custom domain status, for the Shopify-style add-domain flow.
--
-- Until now `tenants.custom_domain` was a single nullable hostname with no
-- lifecycle: it was either set (and assumed to work) or null. To support
-- "add domain → wait for DNS + SSL → activate" we need to know which state
-- the domain is in, and what Vercel told us to show the merchant (TXT
-- challenge + recommended A/CNAME). The proxy (host→tenant rewrite) only
-- routes traffic when status='active' — pending domains do not get traffic
-- so a broken DNS pointer can't take a storefront offline.

CREATE TYPE "CustomDomainStatus" AS ENUM ('none', 'pending', 'active', 'error');

ALTER TABLE "tenants"
  ADD COLUMN "custom_domain_status"       "CustomDomainStatus" NOT NULL DEFAULT 'none',
  ADD COLUMN "custom_domain_verification" JSONB,
  ADD COLUMN "custom_domain_config"       JSONB,
  ADD COLUMN "custom_domain_added_at"     TIMESTAMP(3),
  ADD COLUMN "custom_domain_verified_at"  TIMESTAMP(3),
  ADD COLUMN "custom_domain_last_error"   TEXT;

-- Existing rows that already have a custom_domain set were manually wired
-- up (the field existed before this flow). Assume those are live and mark
-- them 'active' so the proxy continues to serve them.
UPDATE "tenants"
SET "custom_domain_status" = 'active',
    "custom_domain_verified_at" = NOW()
WHERE "custom_domain" IS NOT NULL;
