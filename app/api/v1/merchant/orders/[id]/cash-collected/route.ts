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
 * Confirm cash received at the counter. Supports both full settlement
 * AND partial split payments (cash + card on the same order):
 *
 * - If the accumulated cash collected (existing + this call) reaches the
 *   order total, the order flips to paid + confirmed (existing behaviour).
 * - If still short, Order.cashCollected accumulates, paymentStatus stays
 *   pending, and the response signals the remaining due so the cashier
 *   can chain a card charge for the balance.
 *
 * Day-end reconciliation reads Order.cashCollected and the
 * PaymentTransaction rows side-by-side.
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
    select: {
      id: true,
      tenantId: true,
      total: true,
      paymentStatus: true,
      status: true,
      cashCollected: true,
      confirmedAt: true,
    },
  });
  if (!order || order.tenantId !== session.tenantId) {
    return apiError("not_found", "הזמנה לא נמצאה", 404);
  }
  if (order.paymentStatus === "paid") {
    return apiError("already_paid", "ההזמנה כבר שולמה", 409);
  }

  const existingCash = order.cashCollected ?? 0;
  const newCash = existingCash + body.amount;
  const fullyPaid = newCash >= order.total;
  const remaining = Math.max(0, order.total - newCash);

  // shift_id is optional in the schema but required in practice - the
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
        // Only flip to paid + confirmed when the full total is covered.
        // Partial cash leaves paymentStatus=pending so a follow-up card
        // charge can complete the order via the Grow callback.
        paymentStatus: fullyPaid ? "paid" : order.paymentStatus,
        status: fullyPaid ? "confirmed" : order.status,
        confirmedAt: fullyPaid && !order.confirmedAt ? new Date() : order.confirmedAt,
        // Keep paymentMethod=cash for full cash. For partial cash the
        // payment-method endpoint will flip it to card before pay/initiate.
        ...(fullyPaid ? { paymentMethod: "cash" as const } : {}),
        cashCollected: newCash,
        cashChange: fullyPaid ? body.change : 0,
        cashierId: session.userId,
        posShiftId: shiftId,
      },
    }),
    // Event drives the kitchen kanban + KDS realtime so they see the
    // order pop into the "preparing" lane the moment the cashier
    // confirms cash. Partial cash fires a different event tag so
    // downstream consumers don't mistake it for a settled order.
    prisma.orderEvent.create({
      data: {
        orderId: id,
        type: fullyPaid ? "status_changed" : "payment_partial",
        payload: {
          from: order.status,
          to: fullyPaid ? "confirmed" : order.status,
          changed_by: "cashier",
          payment_method: "cash",
          cash_collected_now: body.amount,
          cash_collected_total: newCash,
          cash_change: fullyPaid ? body.change : 0,
          fully_paid: fullyPaid,
          remaining,
        },
      },
    }),
  ]);

  return apiJson({ ok: true, fully_paid: fullyPaid, remaining });
});
