-- Per-pool deal gifts ("one topping + one cheddar slice included").
-- Default empty array = no pools, so existing deals price exactly as before.
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "free_rules" JSONB NOT NULL DEFAULT '[]';
