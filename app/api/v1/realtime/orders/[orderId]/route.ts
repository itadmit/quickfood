import { createSseStream, wait, type SseEvent } from "@/lib/realtime/sse";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POLL_MS = 2_000;
const COURIER_LOCATION_INTERVAL_MS = 30_000;

export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  return createSseStream(req, async function* (): AsyncGenerator<SseEvent> {
    let lastEventAt = new Date(0);

    const initial = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        courierId: true,
        createdAt: true,
        courier: { select: { name: true, phone: true, currentLat: true, currentLng: true } },
      },
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
        courier_name: initial.courier?.name ?? null,
        courier_phone: initial.courier?.phone ?? null,
        courier_lat: initial.courier?.currentLat ? Number(initial.courier.currentLat) : null,
        courier_lng: initial.courier?.currentLng ? Number(initial.courier.currentLng) : null,
      },
    };
    lastEventAt = initial.createdAt;
    let nextLocationPushAt = Date.now() + COURIER_LOCATION_INTERVAL_MS;
    let lastCourierKey = `${initial.courier?.currentLat ?? ""},${initial.courier?.currentLng ?? ""}`;

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

      if (Date.now() >= nextLocationPushAt) {
        nextLocationPushAt = Date.now() + COURIER_LOCATION_INTERVAL_MS;
        const fresh = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            status: true,
            courier: { select: { currentLat: true, currentLng: true, lastSeenAt: true } },
          },
        });
        if (
          fresh?.courier &&
          (fresh.status === "out_for_delivery" || fresh.status === "ready")
        ) {
          const key = `${fresh.courier.currentLat ?? ""},${fresh.courier.currentLng ?? ""}`;
          if (key !== lastCourierKey) {
            lastCourierKey = key;
            yield {
              event: "courier_location",
              data: {
                lat: fresh.courier.currentLat ? Number(fresh.courier.currentLat) : null,
                lng: fresh.courier.currentLng ? Number(fresh.courier.currentLng) : null,
                last_seen_at: fresh.courier.lastSeenAt?.toISOString() ?? null,
              },
            };
          }
        }
      }
    }
  });
}
