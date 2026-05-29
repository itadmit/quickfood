-- CreateTable: cash_settlements
CREATE TABLE "cash_settlements" (
    "id"           UUID NOT NULL,
    "tenant_id"    UUID NOT NULL,
    "courier_id"   UUID NOT NULL,
    "amount"       INTEGER NOT NULL,
    "settled_by"   TEXT NOT NULL,
    "settled_by_id" UUID,
    "notes"        TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_settlements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cash_settlements_courier_id_created_at_idx"
  ON "cash_settlements"("courier_id", "created_at" DESC);
CREATE INDEX "cash_settlements_tenant_id_created_at_idx"
  ON "cash_settlements"("tenant_id", "created_at" DESC);

ALTER TABLE "cash_settlements"
  ADD CONSTRAINT "cash_settlements_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cash_settlements"
  ADD CONSTRAINT "cash_settlements_courier_id_fkey"
  FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
