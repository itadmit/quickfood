-- Per-store toggle for the "קטגוריות" rail on the classic storefront home.
-- When false the category icon rail is hidden; the merchant can keep a clean
-- home that leads straight into popular items + the full menu. Default true
-- keeps the existing behaviour. Only affects the classic layout - the
-- category_grid layout is built around categories and ignores this flag.

ALTER TABLE "tenants" ADD COLUMN "show_categories_rail" BOOLEAN NOT NULL DEFAULT true;
