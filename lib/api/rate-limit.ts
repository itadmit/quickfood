import { apiError } from "@/lib/api-response";

const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 600;

interface Bucket {
  hits: number[];
}

const globalForRl = globalThis as unknown as {
  __qf_rateLimit?: Map<string, Bucket>;
  __qf_rateLimitGcAt?: number;
};

const buckets: Map<string, Bucket> =
  globalForRl.__qf_rateLimit ?? new Map();
if (!globalForRl.__qf_rateLimit) globalForRl.__qf_rateLimit = buckets;

function gc(now: number) {
  if ((globalForRl.__qf_rateLimitGcAt ?? 0) + WINDOW_MS > now) return;
  globalForRl.__qf_rateLimitGcAt = now;
  for (const [k, b] of buckets) {
    const fresh = b.hits.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) buckets.delete(k);
    else b.hits = fresh;
  }
}

export interface RateLimitOk {
  limit: number;
  remaining: number;
  resetSec: number;
}

/**
 * Per-process sliding-window limiter. On Vercel with N instances the actual
 * cap is N × `limit`, which is intentional: this layer exists to break
 * runaway loops, not to enforce a hard global quota. For strict global caps
 * add Upstash Redis later (single line swap).
 */
export function checkRate(
  key: string,
  limit = DEFAULT_LIMIT,
): RateLimitOk {
  const now = Date.now();
  gc(now);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const resetSec = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    throw new Response(
      JSON.stringify({
        error: {
          code: "rate_limited",
          message: `חרגת ממכסת הקריאות (${limit}/דקה). נסה שוב בעוד ${resetSec} שניות.`,
        },
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "retry-after": String(resetSec),
          "x-ratelimit-limit": String(limit),
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(resetSec),
        },
      },
    );
  }

  bucket.hits.push(now);
  return {
    limit,
    remaining: limit - bucket.hits.length,
    resetSec: Math.ceil(WINDOW_MS / 1000),
  };
}

/**
 * Convenience: throw 429 (as a Response — caught by `handler()`) when too
 * many requests have come from the given identifier in the last minute.
 */
export function assertApiKeyRateLimit(apiKeyId: string, limit?: number): void {
  try {
    checkRate(`apikey:${apiKeyId}`, limit);
  } catch (err) {
    if (err instanceof Response) throw err;
    throw apiError("rate_limited", "חרגת ממכסת הקריאות", 429);
  }
}
