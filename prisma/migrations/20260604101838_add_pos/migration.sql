-- POS (cashier) screen: roles, kiosk/pos sources, cashier+shift FKs, PosShift table.

-- Enum extensions
ALTER TYPE "OrderSource" ADD VALUE 'kiosk';
ALTER TYPE "OrderSource" ADD VALUE 'pos';
ALTER TYPE "UserRole"    ADD VALUE 'cashier';

-- Branch pin for cashier users (informational for other roles)
ALTER TABLE "merchant_users" ADD COLUMN "branch_id" UUID;
ALTER TABLE "merchant_users"
  ADD CONSTRAINT "merchant_users_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "merchant_users_branch_id_idx" ON "merchant_users"("branch_id");

-- Cash change handed back + cashier + shift FKs on Order
ALTER TABLE "orders" ADD COLUMN "cash_change"   INTEGER;
ALTER TABLE "orders" ADD COLUMN "cashier_id"    UUID;
ALTER TABLE "orders" ADD COLUMN "pos_shift_id"  UUID;

-- Shift table — one row per cashier × open-period
CREATE TABLE "pos_shifts" (
  "id"             UUID         NOT NULL,
  "tenant_id"      UUID         NOT NULL,
  "branch_id"      UUID         NOT NULL,
  "cashier_id"     UUID         NOT NULL,
  "opened_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at"      TIMESTAMP(3),
  "opening_float"  INTEGER      NOT NULL,
  "closing_float"  INTEGER,
  "expected_cash"  INTEGER,
  "cash_out_notes" JSONB        NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT "pos_shifts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_shifts_cashier_opened_at_key" ON "pos_shifts"("cashier_id", "opened_at");
CREATE INDEX "pos_shifts_tenant_branch_opened_idx" ON "pos_shifts"("tenant_id", "branch_id", "opened_at" DESC);
CREATE INDEX "pos_shifts_cashier_closed_idx" ON "pos_shifts"("cashier_id", "closed_at");
CREATE INDEX "orders_pos_shift_id_idx" ON "orders"("pos_shift_id");

ALTER TABLE "pos_shifts"
  ADD CONSTRAINT "pos_shifts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_shifts"
  ADD CONSTRAINT "pos_shifts_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pos_shifts"
  ADD CONSTRAINT "pos_shifts_cashier_id_fkey"
  FOREIGN KEY ("cashier_id") REFERENCES "merchant_users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_cashier_id_fkey"
  FOREIGN KEY ("cashier_id") REFERENCES "merchant_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_pos_shift_id_fkey"
  FOREIGN KEY ("pos_shift_id") REFERENCES "pos_shifts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
