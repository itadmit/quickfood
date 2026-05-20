-- Drop the legacy joined-name columns. All application code now reads
-- firstName / lastName (Customer) and customer_first_name_snap /
-- customer_last_name_snap (Order). The QuickFood backend is new; we
-- don't need the dual-write compatibility window any longer.

ALTER TABLE "customers" DROP COLUMN "name";
ALTER TABLE "orders"    DROP COLUMN "customer_name_snap";
