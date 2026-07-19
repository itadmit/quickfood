CREATE TABLE "loyalty_redemptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "points" INTEGER NOT NULL,
  "value_shekels" INTEGER NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "loyalty_redemptions_order_id_key" ON "loyalty_redemptions"("order_id");
CREATE INDEX "loyalty_redemptions_tenant_id_customer_id_idx" ON "loyalty_redemptions"("tenant_id", "customer_id");
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
