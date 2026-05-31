-- Sales / merchandising knobs.
ALTER TABLE "tenants"
  ADD COLUMN "featured_badge_label" VARCHAR(40),
  ADD COLUMN "upsell_size_nudge" BOOLEAN NOT NULL DEFAULT true;
