import { createSseStream, wait, type SseEvent } from "@/lib/realtime/sse";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLL_MS = 2_000;
const COURIER_LOCATION_INTERVAL_MS = 30_000;
// Recycle the stream shortly before maxDuration so the function exits cleanly
// and releases its Neon connection. EventSource reconnects automatically and
// the next snapshot re-syncs state, so nothing is lost across the gap.
const STREAM_TTL_MS = 55_000;

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
        customerId: true,
        createdAt: true,
        courier: { select: { name: true, phone: true, currentLat: true, currentLng: true } },
      },
    });
    if (!initial) {
      yield { event: "not_found", data: { order_id: orderId } };
      return;
    }

    // Visibility matches GET /api/v1/customer/orders/[id]: a logged-in
    // customer must own the order; guest orders stay public-by-UUID
    // (MVP - the receipt link is the auth token). The SSE used to skip
    // this check entirely, leaking live courier GPS + phone to anyone
    // who knew the order UUID.
    const session = await getSession();
    if (
      session?.type === "customer" &&
      initial.customerId &&
      initial.customerId !== session.userId
    ) {
      yield { event: "forbidden", data: { order_id: orderId } };
      return;
    }
    const liveTracking =
      initial.status === "out_for_delivery" || initial.status === "ready";
    yield {
      event: "snapshot",
      id: `${initial.id}:${initial.createdAt.getTime()}`,
      data: {
        order_id: initial.id,
        status: initial.status,
        courier_id: initial.courierId,
        courier_name: initial.courier?.name ?? null,
        courier_phone: initial.courier?.phone ?? null,
        courier_lat:
          liveTracking && initial.courier?.currentLat
            ? Number(initial.courier.currentLat)
            : null,
        courier_lng:
          liveTracking && initial.courier?.currentLng
            ? Number(initial.courier.currentLng)
            : null,
      },
    };
    lastEventAt = initial.createdAt;
    let nextLocationPushAt = Date.now() + COURIER_LOCATION_INTERVAL_MS;
    let lastCourierKey = `${initial.courier?.currentLat ?? ""},${initial.courier?.currentLng ?? ""}`;
    const deadline = Date.now() + STREAM_TTL_MS;

    while (Date.now() < deadline) {
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
