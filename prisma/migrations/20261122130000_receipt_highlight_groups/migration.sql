ALTER TABLE "item_option_groups" ADD COLUMN IF NOT EXISTS "highlight_on_receipt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "modifier_sets" ADD COLUMN IF NOT EXISTS "highlight_on_receipt" BOOLEAN NOT NULL DEFAULT false;
