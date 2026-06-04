import { prisma } from "@/lib/db/client";

export interface ShiftSummary {
  expected_cash: number;
  cash_orders_total: number;
  card_orders_total: number;
  cash_orders_count: number;
  card_orders_count: number;
  cash_out_total: number;
}

interface CashOutNote {
  ts: string;
  amount: number;
  reason?: string;
}

/**
 * Sums every paid order in the shift, splits by payment method, and adds
 * mid-shift drawer drops. expectedCash = openingFloat + cash sales − cashOut.
 * The orders query intentionally includes any order with `posShiftId =
 * shiftId` regardless of `paymentStatus` so a refunded/cancelled order
 * doesn't accidentally inflate the float (status filter at the call site).
 */
export async function computeShiftSummary(shiftId: string): Promise<ShiftSummary> {
  const shift = await prisma.posShift.findUnique({
    where: { id: shiftId },
    select: { openingFloat: true, cashOutNotes: true },
  });
  if (!shift) {
    return {
      expected_cash: 0,
      cash_orders_total: 0,
      card_orders_total: 0,
      cash_orders_count: 0,
      card_orders_count: 0,
      cash_out_total: 0,
    };
  }

  const paid = await prisma.order.findMany({
    where: { posShiftId: shiftId, paymentStatus: "paid" },
    select: { total: true, paymentMethod: true, cashCollected: true },
  });

  let cashTotal = 0;
  let cardTotal = 0;
  let cashCount = 0;
  let cardCount = 0;
  for (const o of paid) {
    if (o.paymentMethod === "cash") {
      cashTotal += o.total;
      cashCount += 1;
    } else {
      cardTotal += o.total;
      cardCount += 1;
    }
  }

  const notes = (shift.cashOutNotes ?? []) as unknown as CashOutNote[];
  const cashOutTotal = notes.reduce((s, n) => s + (Number(n.amount) || 0), 0);

  const expected = shift.openingFloat + cashTotal - cashOutTotal;

  return {
    expected_cash: expected,
    cash_orders_total: cashTotal,
    card_orders_total: cardTotal,
    cash_orders_count: cashCount,
    card_orders_count: cardCount,
    cash_out_total: cashOutTotal,
  };
}
