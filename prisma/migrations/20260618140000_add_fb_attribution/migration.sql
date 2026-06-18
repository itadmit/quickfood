-- Meta browser/click ids captured at signup, reused for the server-side
-- Purchase conversion fired from the billing webhook.
ALTER TABLE "tenants" ADD COLUMN "fb_fbp" TEXT;
ALTER TABLE "tenants" ADD COLUMN "fb_fbc" TEXT;
