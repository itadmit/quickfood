-- Move SMS from a separate subscription on the billing hub to one-off
-- top-up charges. Credits now stack. Add a local 7-day trial timestamp.

ALTER TABLE "tenants" ADD COLUMN "trial_ends_at" TIMESTAMP(3);

ALTER TABLE "tenants" DROP COLUMN "sms_plan";
ALTER TABLE "tenants" DROP COLUMN "billing_sms_subscription_id";

DROP TYPE IF EXISTS "SmsPlan";
