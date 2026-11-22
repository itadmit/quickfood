-- Deal day/hour windows, same contract as menu_items / menu_categories.
-- All nullable: NULL = always active, so existing deals keep working.
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "available_from" INTEGER;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "available_to" INTEGER;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "available_days" INTEGER;
