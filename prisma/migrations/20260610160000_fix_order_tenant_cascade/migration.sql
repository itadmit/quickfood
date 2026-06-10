-- Fix orders.tenant_id FK to CASCADE on tenant delete (was RESTRICT)
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_tenant_id_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix orders.branch_id FK to CASCADE on branch delete (was RESTRICT)
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_branch_id_fkey";
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
