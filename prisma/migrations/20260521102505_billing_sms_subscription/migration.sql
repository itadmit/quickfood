-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "billing_setup_completed_at" TIMESTAMP(3),
ADD COLUMN     "billing_sms_subscription_id" TEXT;
