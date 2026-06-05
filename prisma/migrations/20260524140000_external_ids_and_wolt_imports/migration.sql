-- CreateEnum
CREATE TYPE "WoltImportStatus" AS ENUM ('preview', 'committed', 'failed');

-- AlterTable: provenance columns on menu_categories
ALTER TABLE "menu_categories"
  ADD COLUMN "external_source" VARCHAR(20),
  ADD COLUMN "external_id"     VARCHAR(64);

-- AlterTable: provenance columns on menu_items
ALTER TABLE "menu_items"
  ADD COLUMN "external_source" VARCHAR(20),
  ADD COLUMN "external_id"     VARCHAR(64);

-- AlterTable: provenance columns on modifier_sets
ALTER TABLE "modifier_sets"
  ADD COLUMN "external_source" VARCHAR(20),
  ADD COLUMN "external_id"     VARCHAR(64);

-- AlterTable: provenance column on modifier_set_options (scoped per set)
ALTER TABLE "modifier_set_options"
  ADD COLUMN "external_id" VARCHAR(64);

-- CreateIndex (unique) - Postgres treats multiple NULL tuples as distinct,
-- so manually-created rows (all-NULL externals) don't collide with each
-- other; only true source-duplicates within a tenant trigger the conflict.
CREATE UNIQUE INDEX "menu_categories_tenant_id_external_source_external_id_key"
  ON "menu_categories"("tenant_id", "external_source", "external_id");

CREATE UNIQUE INDEX "menu_items_tenant_id_external_source_external_id_key"
  ON "menu_items"("tenant_id", "external_source", "external_id");

CREATE UNIQUE INDEX "modifier_sets_tenant_id_external_source_external_id_key"
  ON "modifier_sets"("tenant_id", "external_source", "external_id");

CREATE UNIQUE INDEX "modifier_set_options_set_id_external_id_key"
  ON "modifier_set_options"("set_id", "external_id");

-- CreateTable
CREATE TABLE "wolt_imports" (
    "id"                  UUID              NOT NULL,
    "tenant_id"           UUID              NOT NULL,
    "source_url"          TEXT              NOT NULL,
    "venue_id"            VARCHAR(64)       NOT NULL,
    "venue_name"          TEXT              NOT NULL,
    "status"              "WoltImportStatus" NOT NULL,
    "categories_total"    INTEGER           NOT NULL DEFAULT 0,
    "items_total"         INTEGER           NOT NULL DEFAULT 0,
    "categories_imported" INTEGER           NOT NULL DEFAULT 0,
    "items_imported"      INTEGER           NOT NULL DEFAULT 0,
    "images_uploaded"     INTEGER           NOT NULL DEFAULT 0,
    "errors"              JSONB,
    "raw_menu"            JSONB,
    "created_at"          TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at"        TIMESTAMP(3),

    CONSTRAINT "wolt_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wolt_imports_tenant_id_created_at_idx"
  ON "wolt_imports"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "wolt_imports" ADD CONSTRAINT "wolt_imports_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
