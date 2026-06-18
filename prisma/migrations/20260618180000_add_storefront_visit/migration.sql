-- First-party storefront visit tracking (visitors / unique customers).
CREATE TABLE "storefront_visits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "customer_id" UUID,
    "day" TIMESTAMP(3) NOT NULL,
    "visits" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storefront_visits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "storefront_visits_tenant_id_visitor_id_day_key" ON "storefront_visits" ("tenant_id", "visitor_id", "day");
CREATE INDEX "storefront_visits_tenant_id_day_idx" ON "storefront_visits" ("tenant_id", "day");

ALTER TABLE "storefront_visits" ADD CONSTRAINT "storefront_visits_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
