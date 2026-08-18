-- Per-category time-of-day / weekday windowing (mirrors menu_items). Outside
-- the window the category and its items are hidden from the storefront.
ALTER TABLE "menu_categories" ADD COLUMN "available_from" INTEGER;
ALTER TABLE "menu_categories" ADD COLUMN "available_to" INTEGER;
ALTER TABLE "menu_categories" ADD COLUMN "available_days" INTEGER;
