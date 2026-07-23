CREATE TYPE "StorefrontLayout" AS ENUM ('classic', 'category_grid');

ALTER TABLE "tenants" ADD COLUMN "storefront_layout" "StorefrontLayout" NOT NULL DEFAULT 'classic';
