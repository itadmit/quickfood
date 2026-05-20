-- Split Customer.name into firstName + lastName, plus matching first/last
-- snapshots on Order. The legacy `name` / `customer_name_snap` columns
-- stay around so older code paths (notification builders, payment
-- provider integrations) keep functioning — application code now writes
-- the joined value into them on every customer/order write.

-- ────────────────────────────────────────────────────────────────────
-- Customer.firstName / lastName
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE "customers" ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "customers" ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '';

-- Backfill: split on the FIRST space. "ישראל ישראלי" → first="ישראל",
-- last="ישראלי".  Single-word names land entirely in first_name.
UPDATE "customers"
SET
  "first_name" = CASE
    WHEN position(' ' IN "name") > 0
      THEN trim(split_part("name", ' ', 1))
    ELSE "name"
  END,
  "last_name" = CASE
    WHEN position(' ' IN "name") > 0
      THEN trim(substring("name" FROM position(' ' IN "name") + 1))
    ELSE ''
  END
WHERE "name" <> '';

-- ────────────────────────────────────────────────────────────────────
-- Order.customerFirstNameSnap / customerLastNameSnap
-- ────────────────────────────────────────────────────────────────────

ALTER TABLE "orders" ADD COLUMN "customer_first_name_snap" TEXT;
ALTER TABLE "orders" ADD COLUMN "customer_last_name_snap" TEXT;

UPDATE "orders"
SET
  "customer_first_name_snap" = CASE
    WHEN "customer_name_snap" IS NULL OR "customer_name_snap" = '' THEN NULL
    WHEN position(' ' IN "customer_name_snap") > 0
      THEN trim(split_part("customer_name_snap", ' ', 1))
    ELSE "customer_name_snap"
  END,
  "customer_last_name_snap" = CASE
    WHEN "customer_name_snap" IS NULL OR "customer_name_snap" = '' THEN NULL
    WHEN position(' ' IN "customer_name_snap") > 0
      THEN trim(substring("customer_name_snap" FROM position(' ' IN "customer_name_snap") + 1))
    ELSE NULL
  END
WHERE "customer_name_snap" IS NOT NULL;
