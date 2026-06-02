import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const checkout = await prisma.kioskPendingCheckout.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        orderId: true,
        amount: true,
        expiresAt: true,
        tenant: { select: { slug: true } },
      },
    });
    if (!checkout) return apiError("not_found", "checkout לא נמצא", 404);

    let order: { number: string; payment_status: string } | null = null;
    if (checkout.orderId) {
      const o = await prisma.order.findUnique({
        where: { id: checkout.orderId },
        select: { number: true, paymentStatus: true },
      });
      if (o) order = { number: o.number, payment_status: o.paymentStatus };
    }

    return apiJson({
      checkout: {
        id: checkout.id,
        status: checkout.status,
        order_id: checkout.orderId,
        amount: checkout.amount,
        expires_at: checkout.expiresAt.toISOString(),
        tenant_slug: checkout.tenant.slug,
      },
      order,
    });
  },
);
