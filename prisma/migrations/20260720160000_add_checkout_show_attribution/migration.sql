-- Let merchants hide the "how did you hear about us?" attribution prompt at
-- checkout. On by default so existing stores keep feeding sources analytics.
ALTER TABLE "tenants"
    ADD COLUMN "checkout_show_attribution" BOOLEAN NOT NULL DEFAULT true;
