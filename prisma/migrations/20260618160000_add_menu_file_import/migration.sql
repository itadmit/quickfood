-- AI-extracted menu import from an uploaded PDF or photo.
CREATE TYPE "MenuFileImportSource" AS ENUM ('pdf', 'image');

CREATE TABLE "menu_file_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "source" "MenuFileImportSource" NOT NULL,
    "status" "WoltImportStatus" NOT NULL,
    "file_name" TEXT NOT NULL,
    "categories_total" INTEGER NOT NULL DEFAULT 0,
    "items_total" INTEGER NOT NULL DEFAULT 0,
    "categories_imported" INTEGER NOT NULL DEFAULT 0,
    "items_imported" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "extraction" JSONB,
    "model" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committed_at" TIMESTAMP(3),
    "imported_by_user_id" TEXT,

    CONSTRAINT "menu_file_imports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "menu_file_imports_tenant_id_created_at_idx" ON "menu_file_imports" ("tenant_id", "created_at" DESC);

ALTER TABLE "menu_file_imports" ADD CONSTRAINT "menu_file_imports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
