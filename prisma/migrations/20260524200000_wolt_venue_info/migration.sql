-- Add free-text "about" on the tenant - populated by the Wolt importer
-- from the venue's description blob, and editable later from
-- Settings → Branding.
ALTER TABLE "tenants" ADD COLUMN "about" TEXT;

-- Audit trail for the venue info payload (separate from rawMenu) so a
-- future re-run, debugging, or a mapping change can replay against the
-- exact data Wolt returned at import time.
ALTER TABLE "wolt_imports" ADD COLUMN "raw_venue" JSONB;
