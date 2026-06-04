import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  amount: z.number().int().min(1).max(1_000_000),
  change: z.number().int().min(0).max(1_000_000),
  shift_id: z.string().uuid().optional(),
});

/**
 * Confirm cash received at the counter. Marks the order paid + confirmed,
 * snapshots the cashier + shift, stores the customer's tendered amount
 * and computed change so day-end can reconcile the drawer.
 */
export const POST = handler(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const session = await requireMerchant(["cashier", "owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = Schema.parse(await req.json());

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, tenantId: true, total: true, paymentStatus: true, status: true },
  });
  if (!order || order.tenantId !== session.tenantId) {
    return apiError("not_found", "הזמנה לא נמצאה", 404);
  }
  if (order.paymentStatus === "paid") {
    return apiError("already_paid", "ההזמנה כבר שולמה", 409);
  }
  if (body.amount < order.total) {
    return apiError("insufficient", "סכום נמוך מהחיוב", 422);
  }

  // shift_id is optional in the schema but required in practice — the
  // open shift is the source of truth, and we resolve it from the cashier
  // when the client omits it.
  let shiftId = body.shift_id ?? null;
  if (!shiftId) {
    const open = await prisma.posShift.findFirst({
      where: { cashierId: session.userId, closedAt: null },
      select: { id: true },
    });
    shiftId = open?.id ?? null;
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id },
      data: {
        paymentStatus: "paid",
        status: "confirmed",
        confirmedAt: new Date(),
        paymentMethod: "cash",
        cashCollected: body.amount,
        cashChange: body.change,
        cashierId: session.userId,
        posShiftId: shiftId,
      },
    }),
    // Event drives the kitchen kanban + KDS realtime so they see the
    // order pop into the "preparing" lane the moment the cashier
    // confirms cash.
    prisma.orderEvent.create({
      data: {
        orderId: id,
        type: "status_changed",
        payload: {
          from: order.status,
          to: "confirmed",
          changed_by: "cashier",
          payment_method: "cash",
          cash_collected: body.amount,
          cash_change: body.change,
        },
      },
    }),
  ]);

  return apiJson({ ok: true });
});
