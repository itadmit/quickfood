-- Per-item size control inside a deal: pin a deal item to a specific size, or
-- leave null so the customer chooses. Plain id (no FK) - runtime-validated
-- against the item's live sizes.
ALTER TABLE "deal_slot_choices"
    ADD COLUMN "fixed_size_id" UUID;
