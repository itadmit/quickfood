-- Per-side cap for half-pizza topping groups. NULL = legacy global cap.
ALTER TABLE "item_option_groups" ADD COLUMN "max_per_side" INTEGER;
ALTER TABLE "modifier_sets"     ADD COLUMN "max_per_side" INTEGER;
