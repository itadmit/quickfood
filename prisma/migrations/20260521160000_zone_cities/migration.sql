-- DeliveryZone.cities — list of Hebrew city names this zone delivers
-- to. Storefront unions the cities of all active zones to render the
-- "select your city" picker (Wolt-style). Empty default so existing
-- zones don't claim coverage they don't have.

ALTER TABLE "delivery_zones"
  ADD COLUMN "cities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
