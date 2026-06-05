-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "onboarding_dismissed_at" TIMESTAMP(3);

-- Backfill existing tenants - anyone who's been around long enough to
-- have a tenant row already saw the dashboard without an overlay, so
-- they shouldn't suddenly get welcomed. New signups land with NULL.
UPDATE "tenants" SET "onboarding_dismissed_at" = CURRENT_TIMESTAMP
  WHERE "onboarding_dismissed_at" IS NULL;
