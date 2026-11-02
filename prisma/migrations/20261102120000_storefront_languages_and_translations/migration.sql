-- Opt-in storefront languages (always includes 'he').
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storefront_languages" TEXT[] NOT NULL DEFAULT ARRAY['he']::TEXT[];

-- Auto-translation cache for merchant-authored storefront content.
CREATE TABLE IF NOT EXISTS "translations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "entity_type" VARCHAR(32) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" VARCHAR(32) NOT NULL,
    "lang" VARCHAR(8) NOT NULL,
    "source_hash" VARCHAR(64) NOT NULL,
    "text" TEXT NOT NULL,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "translations_entity_type_entity_id_field_lang_key" ON "translations" ("entity_type", "entity_id", "field", "lang");
CREATE INDEX IF NOT EXISTS "translations_tenant_id_lang_idx" ON "translations" ("tenant_id", "lang");

DO $$ BEGIN
    ALTER TABLE "translations" ADD CONSTRAINT "translations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
