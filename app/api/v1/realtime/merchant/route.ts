import { createSseStream, wait, type SseEvent } from "@/lib/realtime/sse";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 2_000;

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.type !== "merchant" || !session.tenantId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const tenantId = session.tenantId;

  return createSseStream(req, async function* (): AsyncGenerator<SseEvent> {
    let lastSeen = new Date();

    while (true) {
      await wait(POLL_MS);

      // New orders since lastSeen
      const newOrders = await prisma.order.findMany({
        where: { tenantId, createdAt: { gt: lastSeen } },
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
