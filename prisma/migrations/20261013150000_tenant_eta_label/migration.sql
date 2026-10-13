-- Per-tenant override for the storefront delivery-ETA label. When set it
-- replaces the computed "X-Y דק'" / "X-Y ימים" string verbatim on the
-- storefront info strip (e.g. "אספקה תוך 1-2 ימים" for a shipping-model
-- store). NULL keeps the default computed label.

ALTER TABLE "tenants" ADD COLUMN "eta_label" TEXT;
