-- Show live order tracking on the thank-you page by default. Flip the column
-- default for new tenants, and turn it on for every existing tenant (merchants
-- who prefer the plain receipt can opt out again in Settings → Checkout).
ALTER TABLE "tenants" ALTER COLUMN "checkout_show_tracking" SET DEFAULT true;
UPDATE "tenants" SET "checkout_show_tracking" = true;
