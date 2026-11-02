import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { purchaseEligible } from "@/lib/fb/purchase";
import { verifyPurchaseToken } from "@/lib/fb/purchase-token";

export async function POST(req: Request) {
  const input = await req.json().catch(() => null);
  if (!input || typeof input.orderId !== "string" || typeof input.token !== "string" ||
      !verifyPurchaseToken(input.token, input.orderId)) {
    return Response.json({ error: "unauthorized" }, { status: 403 });
  }
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { tenant: { select: { facebookPixelId: true } }, items: true },
  });
  if (!order) return Response.json({ done: true });
  const session = await getSession();
  if (session?.type === "merchant" && session.tenantId === order.tenantId) {
    return Response.json({ done: true });
  }
  if (input.claim && typeof input.claim === "string") {
    await prisma.order.updateMany({
      where: { id: order.id, purchasePixelClaim: input.claim, purchasePixelReportedAt: null },
      data: { purchasePixelReportedAt: new Date(), purchasePixelClaim: null },
    });
    return Response.json({ done: true });
  }
  if (order.purchasePixelReportedAt || !order.tenant.facebookPixelId ||
      ["cancelled", "refunded"].includes(order.status) ||
      ["failed", "refunded"].includes(order.paymentStatus)) return Response.json({ done: true });
  if (!purchaseEligible(order)) return Response.json({ retry: true });
  const claim = randomUUID();
  const acquired = await prisma.order.updateMany({
    where: {
      id: order.id, purchasePixelReportedAt: null,
      status: order.status, paymentStatus: order.paymentStatus,
      OR: [{ purchasePixelClaimedAt: null }, { purchasePixelClaimedAt: { lt: new Date(Date.now() - 60000) } }],
    },
    data: { purchasePixelClaim: claim, purchasePixelClaimedAt: new Date() },
  });
  if (!acquired.count) return Response.json({ retry: true });
  return Response.json({
    claim, pixelId: order.tenant.facebookPixelId,
    params: {
      content_type: "product",
      content_ids: order.items.flatMap(it => it.menuItemId ? [it.menuItemId] : []),
      num_items: order.items.reduce((sum, it) => sum + it.quantity, 0),
      value: order.total, currency: "ILS",
    },
  });
}
