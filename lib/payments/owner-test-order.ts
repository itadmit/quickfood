import { prisma } from "@/lib/db/client";
import { OWNER_TEST_ORDER_EVENT, OWNER_TEST_ORDER_NOTE } from "@/lib/payments/owner-test-access";

export function withOwnerTestNote(notes: string | null | undefined): string {
  if (notes?.startsWith(OWNER_TEST_ORDER_NOTE)) return notes;
  return notes ? `${OWNER_TEST_ORDER_NOTE}\n${notes}` : OWNER_TEST_ORDER_NOTE;
}

export async function markOwnerTestOrder(
  orderId: string,
  customerNotes: string | null,
): Promise<void> {
  const existing = await prisma.orderEvent.findFirst({
    where: { orderId, type: OWNER_TEST_ORDER_EVENT },
    select: { id: true },
  });
  if (existing && customerNotes?.startsWith(OWNER_TEST_ORDER_NOTE)) return;
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { customerNotes: withOwnerTestNote(customerNotes) },
    }),
    ...(existing
      ? []
      : [
          prisma.orderEvent.create({
            data: { orderId, type: OWNER_TEST_ORDER_EVENT, payload: { testMode: true } },
          }),
        ]),
  ]);
}
