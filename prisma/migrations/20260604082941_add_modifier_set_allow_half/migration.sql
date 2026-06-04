-- Catalog-level allowHalf default for modifier sets. Propagated to
-- attached ItemOptionGroups on save.
ALTER TABLE "modifier_sets" ADD COLUMN "allow_half" BOOLEAN NOT NULL DEFAULT FALSE;
