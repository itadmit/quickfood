CREATE TYPE "NoticeScope" AS ENUM ('store', 'category', 'item');

CREATE TYPE "NoticeKind" AS ENUM ('info', 'warning', 'allergen', 'kosher', 'dietary');

ALTER TABLE "tenants"
    ADD COLUMN "cutlery_enabled"   BOOLEAN  NOT NULL DEFAULT FALSE,
    ADD COLUMN "cutlery_label"     TEXT     NOT NULL DEFAULT 'סכו״ם חד״פ',
    ADD COLUMN "cutlery_price"     INTEGER  NOT NULL DEFAULT 0,
    ADD COLUMN "cutlery_free_above" INTEGER;

ALTER TABLE "orders"
    ADD COLUMN "cutlery_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "cutlery_fee"   INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "notices" (
    "id"          UUID         PRIMARY KEY,
    "tenant_id"   UUID         NOT NULL,
    "scope"       "NoticeScope" NOT NULL DEFAULT 'store',
    "category_id" UUID,
    "item_id"     UUID,
    "kind"        "NoticeKind" NOT NULL DEFAULT 'info',
    "title"       VARCHAR(120) NOT NULL,
    "body"        VARCHAR(500),
    "icon"        VARCHAR(40),
    "active"      BOOLEAN      NOT NULL DEFAULT TRUE,
    "position"    INTEGER      NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notices_tenant_id_fkey"
        FOREIGN KEY ("tenant_id")   REFERENCES "tenants"("id")           ON DELETE CASCADE,
    CONSTRAINT "notices_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "menu_categories"("id")   ON DELETE CASCADE,
    CONSTRAINT "notices_item_id_fkey"
        FOREIGN KEY ("item_id")     REFERENCES "menu_items"("id")        ON DELETE CASCADE
);

CREATE INDEX "notices_tenant_id_scope_active_position_idx" ON "notices"("tenant_id", "scope", "active", "position");
CREATE INDEX "notices_category_id_idx" ON "notices"("category_id");
CREATE INDEX "notices_item_id_idx"     ON "notices"("item_id");
