-- Minutes added to every customer-facing ETA when branch.status = 'busy'.
ALTER TABLE "branches" ADD COLUMN "busy_eta_boost_minutes" INTEGER NOT NULL DEFAULT 15;
