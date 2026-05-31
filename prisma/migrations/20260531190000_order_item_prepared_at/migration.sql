-- Per-item prep toggle for the kitchen Kanban — tick off each line
-- as it's plated. Nullable; the order's lifecycle status is still
-- the authoritative "ready" signal.
ALTER TABLE "order_items"
  ADD COLUMN "prepared_at" TIMESTAMP(3);
