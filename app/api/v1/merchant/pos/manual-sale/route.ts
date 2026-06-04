import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ManualSaleSchema = z.object({
  amount: z.number().int().min(1).max(1_000_000),
  shift_id: z.string().uuid(),
  customer_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Create a one-line POS order with a free-text "תשלום ידני" snapshot —
 * no menu item attached. Status starts as `pending` + `paymentStatus`
 * pending; the cashier finalizes via `cash-collected` or the Grow wallet
 * callback (card). We don't preset paymentMethod here — the payment sheet
 * picks it after creation.
 */
export const POST = handler(async (req: Request) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = ManualSaleSchema.parse(await req.json());

  const shift = await prisma.posShift.findFirst({
    where: { id: body.shift_id, cashierId: session.userId, closedAt: null },
    select: { id: true, branchId: true },
  });
  if (!shift) return apiError("no_open_shift", "אין משמרת פתוחה תואמת", 404);

  // Order number generator mirrors lib/orders-create.ts — keeps the
  // VR-1234 sequence stable across POS + storefront.
  const counterTenant = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { nextOrderNumber: { increment: 1 } },
    select: { nextOrderNumber: true, slug: true },
  });
  const orderSeq = counterTenant.nextOrderNumber - 1;
  const prefix =
    counterTenant.slug
      .split("-")
      .map((s) => s[0])
      .join("")
      .toUpperCase()
      .slice(0, 3) || "QF";
  const number = `${prefix}-${orderSeq}`;

  const order = await prisma.order.create({
    data: {
      number,
      tenantId: session.tenantId,
      branchId: shift.branchId,
      customerId: body.customer_id ?? null,
      status: "pending",
      method: "pickup",
      source: "pos",
      paymentMethod: "cash",
      paymentStatus: "pending",
      subtotal: body.amount,
      total: body.amount,
      customerNotes: body.notes ?? null,
      cashierId: session.userId,
      posShiftId: shift.id,
      items: {
        create: [
          {
            menuItemId: null,
            nameSnapshot: "תשלום ידני",
            quantity: 1,
            unitPrice: body.amount,
            totalPrice: body.amount,
            source: "menu",
          },
        ],
      },
    },
    select: { id: true, number: true, total: true },
  });

  return apiJson({ order }, 201);
});
