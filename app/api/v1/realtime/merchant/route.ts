import { createSseStream, wait, type SseEvent } from "@/lib/realtime/sse";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { HIDE_UNPAID_NONCASH } from "@/lib/orders-visible";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLL_MS = 2_000;
// Recycle the stream shortly before the platform's maxDuration so the
// function exits cleanly and releases its Neon connection, instead of
// lingering (or being killed mid-write) and starving the pool. The browser
// EventSource reconnects automatically; the client refetches on connect and
// dedups by order id, so the brief gap never drops or double-counts orders.
const STREAM_TTL_MS = 55_000;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const tenantId = session.tenantId;

  return createSseStream(req, async function* (): AsyncGenerator<SseEvent> {
    let lastSeen = new Date();
    const deadline = Date.now() + STREAM_TTL_MS;

    while (Date.now() < deadline) {
      await wait(POLL_MS);

      // New orders since lastSeen. Skip non-cash orders that are still
      // waiting for the Grow callback - they aren't real work yet and
      // would just trigger a noop refresh on the merchant client. When
      // the callback flips them to confirmed, an orderEvent is written
      // and we emit it as `order.status_change` below.
      const newOrders = await prisma.order.findMany({
        where: { tenantId, createdAt: { gt: lastSeen }, NOT: HIDE_UNPAID_NONCASH },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: { id: true, number: true, status: true, createdAt: true },
      });
      for (const o of newOrders) {
        yield {
          event: "order.created",
          id: `${o.id}:created`,
          data: { id: o.id, number: o.number, status: o.status },
        };
        lastSeen = o.createdAt > lastSeen ? o.createdAt : lastSeen;
      }

      // Status changes since lastSeen
      const events = await prisma.orderEvent.findMany({
        where: {
          createdAt: { gt: lastSeen },
          order: { tenantId },
        },
        include: { order: { select: { id: true, number: true } } },
        orderBy: { createdAt: "asc" },
        take: 50,
      });
      for (const e of events) {
        yield {
          event: `order.${e.type}`,
          id: e.id,
          data: { order_id: e.orderId, ...((e.payload as object) ?? {}) },
        };
        lastSeen = e.createdAt > lastSeen ? e.createdAt : lastSeen;
      }
    }
  });
}
