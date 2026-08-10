-- Per-option "always paid": these options are never covered by the group's
-- includedFree allowance (nor the bundle deal) and never consume a free slot.
ALTER TABLE "item_options" ADD COLUMN "exclude_from_free" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "modifier_set_options" ADD COLUMN "exclude_from_free" BOOLEAN NOT NULL DEFAULT false;
