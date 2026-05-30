-- Sequential, per-tenant order numbers.
--
-- Before this, Order.number was random 4-digit ("M-1771", "M-2575") and
-- globally UNIQUE — both a UX wart (merchants saw their orders jumping
-- around) and a real collision risk as the catalog grew (random space
-- is small and the unique index is global).
--
-- After: each tenant carries a counter (tenants.next_order_number),
-- backfilled to (existing order count + 1) so new orders pick up where
-- the merchant's history visually leaves off. The unique constraint on
-- orders.number moves to a composite (tenant_id, number) so tenant A's
-- M-100 and tenant B's M-100 stop fighting.

-- 1. Counter column. Default 1 means a brand-new tenant's first order
--    will be M-1.
ALTER TABLE "tenants"
  ADD COLUMN "next_order_number" INTEGER NOT NULL DEFAULT 1;

-- 2. Backfill existing tenants. Counter sits at (count(orders) + 1)
--    so the very next CREATE picks up exactly there.
UPDATE "tenants" t
SET "next_order_number" = COALESCE(
  (SELECT COUNT(*) FROM "orders" o WHERE o."tenant_id" = t."id"),
  0
) + 1;

-- 3. Drop the global unique on order number — the random-suffix scheme
--    relied on it. The composite per-tenant unique below replaces it.
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_number_key";

-- 4. Composite uniqueness: same number is fine across tenants, never
--    within one tenant.
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tenant_id_number_key"
  ON "orders" ("tenant_id", "number");
