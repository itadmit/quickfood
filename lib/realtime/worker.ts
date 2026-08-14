/**
 * worker.ts — realtime over the shared Cloudflare Worker.
 *
 * (HE) עדכונים חיים דרך Worker משותף עם Quick Chat, על Durable Objects עם
 *      WebSocket Hibernation. מחליף את ה-SSE שדגם את המסד כל 2 שניות.
 *
 * Replaces `lib/realtime/sse.ts`, which was Server-Sent Events over a Vercel
 * function that polled Postgres every 2 seconds for the life of the stream.
 * That design charged us for *viewers × time* rather than for events:
 *
 *   • one held function per open board, billed for provisioned memory the
 *     whole time it was connected — a forgotten browser tab on a Friday
 *     night cost the same as a Saturday rush
 *   • a query every 2s per viewer, which kept the Neon compute permanently
 *     awake and defeated its scale-to-zero
 *
 * Here nothing is held and nothing polls. The write path publishes; the
 * Durable Object hibernates between events; outgoing frames are free. A
 * night with no orders costs nothing at all.
 *
 * This file deliberately duplicates the token format from Quick Chat's
 * `@qs/realtime` package rather than sharing it — the two repositories have
 * no build relationship, and a copied 40-line HMAC is cheaper than coupling
 * their release cycles. The format is the contract; it is stable and small.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface RealtimeConfig {
  baseUrl: string;
  publishSecret: string;
  tokenSecret: string;
}

export function realtimeConfig(): RealtimeConfig | null {
  const baseUrl = process.env.REALTIME_URL?.replace(/\/+$/, "");
  const publishSecret = process.env.REALTIME_PUBLISH_SECRET;
  const tokenSecret = process.env.REALTIME_TOKEN_SECRET;
  if (!baseUrl || !publishSecret || !tokenSecret) return null;
  return { baseUrl, publishSecret, tokenSecret };
}

/* ── Rooms ──────────────────────────────────────────────────────────────
 * The `qf:` and `qforder:` prefixes are what the Worker uses to decide
 * that a request belongs to QuickFood and must be checked against
 * QuickFood's secrets — Quick Chat's credentials are refused on these,
 * and ours on theirs.
 * ─────────────────────────────────────────────────────────────────────── */

export function tenantRoom(tenantId: string): string {
  return `qf:${tenantId}`;
}

export function orderRoom(orderId: string): string {
  return `qforder:${orderId}`;
}

/* ── Tokens ─────────────────────────────────────────────────────────── */

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/**
 * A short-lived, listen-only grant for exactly one room. It cannot publish:
 * that needs the separate publish secret, which never leaves the server.
 */
export function signRoomToken(
  secret: string,
  room: string,
  ttlSeconds = 3600,
): string {
  const body = b64url(
    Buffer.from(
      JSON.stringify({ room, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
    ),
  );
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

/** Present for symmetry and tests; the Worker is what verifies in production. */
export function verifyRoomToken(
  secret: string,
  token: string,
): { room: string; exp: number } | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(
    b64url(createHmac("sha256", secret).update(body).digest()),
  );
  // Length must match before timingSafeEqual, which throws otherwise.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, "base64url").toString());
    if (typeof claims.room !== "string" || typeof claims.exp !== "number") {
      return null;
    }
    if (claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

/* ── Publish ────────────────────────────────────────────────────────── */

/**
 * Fan an event out to a room. Best-effort and never throws: a realtime
 * update is an enhancement, and failing an order because a socket layer was
 * unreachable would be indefensible. Callers should not await this on the
 * critical path — `void publish(...)` is the intended shape.
 */
export async function publish(
  room: string,
  event: string,
  data: Record<string, unknown> = {},
): Promise<boolean> {
  const cfg = realtimeConfig();
  if (!cfg) return false;
  try {
    const res = await fetch(`${cfg.baseUrl}/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.publishSecret}`,
      },
      body: JSON.stringify({ room, event, data }),
      // Must never hold a serverless function open — the entire point of
      // this migration is to stop paying for wall-clock spent waiting.
      signal: AbortSignal.timeout(5_000),
    });
    return res.ok;
  } catch (err) {
    console.error("[realtime] publish failed (non-fatal):", err);
    return false;
  }
}

/** An order was placed. */
export function publishOrderCreated(
  tenantId: string,
  order: { id: string; number: number | string; status: string },
): void {
  void publish(tenantRoom(tenantId), "order.created", order);
}

/**
 * An order moved. Published twice on purpose: the restaurant's board and
 * the customer watching their own order are different rooms, and the
 * customer must not receive the whole tenant's traffic.
 */
export function publishOrderStatus(
  tenantId: string,
  orderId: string,
  payload: Record<string, unknown>,
): void {
  void publish(tenantRoom(tenantId), "order.status_changed", {
    order_id: orderId,
    ...payload,
  });
  void publish(orderRoom(orderId), "status_changed", {
    order_id: orderId,
    ...payload,
  });
}
