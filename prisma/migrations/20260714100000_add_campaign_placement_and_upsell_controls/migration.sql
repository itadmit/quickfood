CREATE TYPE "CampaignPlacement" AS ENUM ('home', 'cart', 'all');
ALTER TABLE "campaigns" ADD COLUMN "placement" "CampaignPlacement" NOT NULL DEFAULT 'home';
ALTER TABLE "menu_items" ADD COLUMN "upsell_in_cart" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenants" ADD COLUMN "cart_upsell_title" VARCHAR(60);
