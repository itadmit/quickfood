import { prisma } from "@/lib/db/client";

/**
 * Durable sliding-window-ish rate limiter backed by Postgres, so it holds
 * ACROSS serverless instances (unlike the in-memory limiter). One atomic
 * statement per hit: insert the bucket, or if it exists increment it (resetting
 * the count + window once the window has elapsed). Returns true while the hit
 * count is within `limit`, false once the bucket is exhausted.
 *
 * Fails OPEN (returns true) on a DB error — a limiter must never take the
 * feature down; the caller keeps its own cheaper guards too.
 */
export async function hitDurable(key: string, limit: number, windowMs: number): Promise<boolean> {
  const resetAt = new Date(Date.now() + windowMs);
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_buckets ("key", "count", "reset_at")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN rate_buckets."reset_at" < now() THEN 1 ELSE rate_buckets."count" + 1 END,
        "reset_at" = CASE WHEN rate_buckets."reset_at" < now() THEN ${resetAt} ELSE rate_buckets."reset_at" END
      RETURNING "count";`;
    const count = Number(rows[0]?.count ?? 1);
    return count <= limit;
  } catch (err) {
    console.error("[durable-rate-limit] failed for", key, err);
    return true;
  }
}
