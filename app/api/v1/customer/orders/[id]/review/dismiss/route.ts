import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mark the review prompt as dismissed for this order. Cross-device sticky:
// once dismissed, neither the login modal nor the home banner will resurface
// for the same order on this customer.
export const POST = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  if (!session || session.type !== "customer") {
    return apiError("unauthorized", "יש להתחבר", 401);
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, customerId: true },
  });
  if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);
  if (order.customerId !== session.userId) {
    return apiError("forbidden", "אין הרשאה", 403);
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { reviewPromptDismissedAt: new Date() },
  });

  return apiJson({ ok: true });
});
