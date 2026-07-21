-- Per-option quantity ceiling for allowQty groups (e.g. "max 2 pitas in the
-- platter"). 0 = no per-option cap; the group's max_select still bounds the
-- total.
ALTER TABLE "item_options"
    ADD COLUMN "max_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "modifier_set_options"
    ADD COLUMN "max_quantity" INTEGER NOT NULL DEFAULT 0;
