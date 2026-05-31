-- "Want to add a dessert?" pre-checkout interstitial flag for
-- MenuCategory. Distinct from upsell_in_cart (continuous carousel
-- inside the open cart sheet); this one fires once right before the
-- customer hits "place order".
ALTER TABLE "menu_categories"
  ADD COLUMN "upsell_before_checkout" BOOLEAN NOT NULL DEFAULT false;
