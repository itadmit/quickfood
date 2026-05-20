-- CreateEnum
CREATE TYPE "PendingPaymentStatus" AS ENUM ('pending', 'confirmed', 'failed', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('success', 'failed', 'refunded', 'partially_refunded');

-- CreateTable
CREATE TABLE "payment_provider_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "test_mode" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_reference" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "status" "PendingPaymentStatus" NOT NULL DEFAULT 'pending',
    "provider_request_id" TEXT,
    "auth_code" TEXT,
    "provider_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "pending_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "pending_payment_id" UUID,
    "provider" "PaymentProvider" NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'success',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "provider_transaction_id" TEXT NOT NULL,
    "provider_request_id" TEXT,
    "provider_token" TEXT,
    "approval_number" TEXT,
    "card_brand" TEXT,
    "card_last_four" TEXT,
    "refunded_amount" INTEGER NOT NULL DEFAULT 0,
    "provider_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_configs_tenant_id_provider_key" ON "payment_provider_configs"("tenant_id", "provider");

-- CreateIndex
CREATE INDEX "pending_payments_order_reference_idx" ON "pending_payments"("order_reference");

-- CreateIndex
CREATE INDEX "pending_payments_provider_request_id_idx" ON "pending_payments"("provider_request_id");

-- CreateIndex
CREATE INDEX "pending_payments_tenant_id_status_created_at_idx" ON "pending_payments"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_transactions_order_id_idx" ON "payment_transactions"("order_id");

-- CreateIndex
CREATE INDEX "payment_transactions_tenant_id_created_at_idx" ON "payment_transactions"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_provider_provider_transaction_id_key" ON "payment_transactions"("provider", "provider_transaction_id");

-- AddForeignKey
ALTER TABLE "payment_provider_configs" ADD CONSTRAINT "payment_provider_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_payments" ADD CONSTRAINT "pending_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_payments" ADD CONSTRAINT "pending_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_pending_payment_id_fkey" FOREIGN KEY ("pending_payment_id") REFERENCES "pending_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
