/**
 * POST /api/v1/realtime/token — a listen-only grant for one room.
 *
 * Replaces the authorization that used to be implicit in the SSE routes:
 * there, holding the connection open *was* the subscription, and the merchant
 * session was checked once at connect. Here the Worker has no access to our
 * database, so a signed token carries the decision instead.
 *
 * Two callers:
 *   merchant — the orders board, scoped to their own tenant
 *   order    — one customer tracking one order
 *
 * The order case reproduces the visibility rule the SSE route had to be
 * patched for: a logged-in customer must own the order, while guest orders
 * stay reachable by UUID because the receipt link is the only credential a
 * guest has. Getting this wrong last time leaked live courier GPS and phone
 * to anyone who knew an order id.
 */
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { orderRoom, realtimeConfig, signRoomToken, tenantRoom } from "@/lib/realtime/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_SECONDS = 60 * 60;

export async function POST(req: Request) {
  const cfg = realtimeConfig();
  // Not configured is a supported state, not an error: the clients fall back
  // to a periodic refetch and the product works.
  if (!cfg) return NextResponse.json({ enabled: false });

  const body = (await req.json().catch(() => null)) as
    | { scope?: string; orderId?: string }
    | null;

  if (body?.scope === "merchant") {
    const session = await getSession();
    if (!session || session.type !== "merchant" || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Derived from the session, never from the request — there is nothing
    // here for a caller to influence.
    const room = tenantRoom(session.tenantId);
    return NextResponse.json({
      enabled: true,
      url: cfg.baseUrl,
      room,
      token: signRoomToken(cfg.tokenSecret, room, TTL_SECONDS),
    });
  }

  if (body?.scope === "order" && body.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: body.orderId },
      select: { id: true, customerId: true },
    });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const session = await getSession();
    if (
      session?.type === "customer" &&
      order.customerId &&
      order.customerId !== session.userId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const room = orderRoom(order.id);
    return NextResponse.json({
      enabled: true,
      url: cfg.baseUrl,
      room,
      token: signRoomToken(cfg.tokenSecret, room, TTL_SECONDS),
    });
  }

  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
