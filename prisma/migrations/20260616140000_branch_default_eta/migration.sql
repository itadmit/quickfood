-- Editable default delivery ETA range per branch (fallback when no zone sets one).
ALTER TABLE "branches" ADD COLUMN     "default_eta_max" INTEGER NOT NULL DEFAULT 35,
ADD COLUMN     "default_eta_min" INTEGER NOT NULL DEFAULT 25;
