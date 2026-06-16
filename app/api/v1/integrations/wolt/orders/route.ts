/**
 * POST /api/v1/integrations/wolt/orders
 *
 * Wolt Order webhook. Wolt POSTs a new order here; we verify the HMAC-SHA256
 * signature against the raw body, resolve the tenant from the venue id, and
 * ingest the order into the Kanban (idempotent on the Wolt order id).
 *
 * Always returns 200 once the signature is valid so Wolt doesn't retry a
 * payload we've already accepted; genuine auth failures return 401.
 */
import { handler, apiError, apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { readSignatureHeader, verifyWoltSignature } from "@/lib/wolt/signature";
import { ingestWoltOrder } from "@/lib/wolt/ingest-order";
import type { WoltOrderPayload } from "@/lib/wolt/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = handler(async (req: Request) => {
  // Raw body first - the HMAC is over the exact bytes Wolt sent.
  const raw = await req.text();
  const signature = readSignatureHeader(req.headers);
  if (!verifyWoltSignature(raw, signature)) {
    console.warn("[wolt/orders] signature verification failed");
    return apiError("invalid_signature", "invalid webhook signature", 401);
  }

  let payload: WoltOrderPayload;
  try {
    payload = JSON.parse(raw) as WoltOrderPayload;
  } catch {
    return apiError("bad_payload", "invalid JSON", 400);
  }

  const venueId = payload.venue_id;
  if (!venueId || !payload.id || !Array.isArray(payload.items)) {
    return apiError("bad_payload", "missing venue_id / id / items", 400);
  }

  const conn = await prisma.woltConnection.findFirst({
    where: { venueId, status: "active" },
    select: { tenantId: true },
  });
  if (!conn) {
    // Signature was valid but we have no connection for this venue - log and
    // 200 so Wolt stops retrying; ops can investigate.
    console.warn("[wolt/orders] no active connection for venue", venueId);
    return apiJson({ received: true, matched: false });
  }

  const result = await ingestWoltOrder(conn.tenantId, payload);
  return apiJson({ received: true, order_id: result.orderId, created: result.created });
});
