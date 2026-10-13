-- Per-store toggle for the storefront delivery/pickup entry popup.
-- When false, the "delivery or pickup?" modal does not auto-open on entry;
-- the customer chooses the method inside checkout instead. Default true keeps
-- the existing popup behaviour.

ALTER TABLE "tenants" ADD COLUMN "method_popup_enabled" BOOLEAN NOT NULL DEFAULT true;
