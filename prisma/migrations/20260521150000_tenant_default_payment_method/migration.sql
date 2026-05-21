-- Add Tenant.defaultPaymentMethod. NULL = "use the platform default
-- order at checkout"; non-null = the merchant picked a specific method
-- to be pre-selected. The PATCH /merchant/payments handler validates
-- the value is still in the tenant's allowed methods.

ALTER TABLE "tenants"
  ADD COLUMN "default_payment_method" "PaymentMethod";
