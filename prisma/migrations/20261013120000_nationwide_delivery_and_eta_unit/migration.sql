-- Two additive delivery options (neither replaces the existing city-zone /
-- minutes-ETA model):
--   1. delivery_zones.nationwide - a catch-all zone that delivers to ANY
--      address at a flat fee. Used as the fallback when no city-specific
--      zone matches, so a store can offer nationwide delivery alongside its
--      regular city zones.
--   2. branches.eta_unit - show delivery time in "days" instead of
--      "minutes" for shipping-model stores (e.g. "1-2 ימים"). Store-wide;
--      the existing min/max ETA numbers are interpreted in this unit.

ALTER TABLE "delivery_zones" ADD COLUMN "nationwide" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "branches" ADD COLUMN "eta_unit" TEXT NOT NULL DEFAULT 'minutes';
