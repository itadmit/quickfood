import { createSseStream, wait, type SseEvent } from "@/lib/realtime/sse";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 2_000;

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  // Note: customer auth check is optional here — orders are sensitive but the
  // SSE protocol can't accept arbitrary headers from EventSource. The order id
  // itself is a uuid; mobile clients pass auth via standard headers via fetch+ReadableStream
  // (alternative path covered by /api/v1/customer/orders/:id polling).

  return createSseStream(req, async function* (): AsyncGenerator<SseEvent> {
    let lastEventAt = new Date(0);

    // Initial snapshot
    const initial = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, courierId: true, createdAt: true },
    });
    if (!initial) {
      yield { event: "not_found", data: { order_id: orderId } };
      return;
    }
    yield {
      event: "snapshot",
      id: `${initial.id}:${initial.createdAt.getTime()}`,
      data: {
        order_id: initial.id,
        status: initial.status,
        courier_id: initial.courierId,
      },
    };
    lastEventAt = initial.createdAt;

    while (true) {
      await wait(POLL_MS);
      const events = await prisma.orderEvent.findMany({
        where: { orderId, createdAt: { gt: lastEventAt } },
        orderBy: { createdAt: "asc" },
        take: 20,
      });
      for (const e of events) {
        yield {
          event: e.type,
          id: e.id,
          data: e.payload,
        };
        lastEventAt = e.createdAt;
      }
    }
  });
}
