-- CreateEnum
CREATE TYPE "SmsPlan" AS ENUM ('none', 'starter', 'growth', 'scale');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'delivered', 'failed', 'skipped_no_balance', 'invalid_recipient');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "billing_customer_id" TEXT,
ADD COLUMN     "billing_payment_method_id" TEXT,
ADD COLUMN     "billing_subscription_id" TEXT,
ADD COLUMN     "sms_credits_remaining" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sms_plan" "SmsPlan" NOT NULL DEFAULT 'none';

-- CreateTable
CREATE TABLE "sms_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "to" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'generic',
    "ref_kind" TEXT,
    "ref_id" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "provider_code" INTEGER,
    "provider_msg" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "to" TEXT NOT NULL,
    "from_name" TEXT NOT NULL DEFAULT '',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'generic',
    "ref_kind" TEXT,
    "ref_id" TEXT,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "provider_id" TEXT,
    "provider_msg" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_logs_tenant_id_created_at_idx" ON "sms_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "sms_logs_ref_kind_ref_id_idx" ON "sms_logs"("ref_kind", "ref_id");

-- CreateIndex
CREATE INDEX "email_logs_tenant_id_created_at_idx" ON "email_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "email_logs_ref_kind_ref_id_idx" ON "email_logs"("ref_kind", "ref_id");

-- AddForeignKey
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
