import { handler, apiJson, apiError } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { verifyReviewToken } from "@/lib/reviews/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mark the review prompt as dismissed for this order. Cross-device sticky:
// once dismissed, neither the login modal nor the home banner will resurface
// for the same order on this customer. Accepts the same dual proof as the
// review POST — session match or signed token in ?t=.
export const POST = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await getSession();
  const { id } = await params;

  const url = new URL(req.url);
  const tokenDecoded = verifyReviewToken(url.searchParams.get("t"));
  const tokenMatches = !!tokenDecoded && tokenDecoded.orderId === id;
  const sessionIsCustomer = !!session && session.type === "customer";

  if (!tokenMatches && !sessionIsCustomer) {
    return apiError("unauthorized", "יש להתחבר", 401);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, customerId: true },
  });
  if (!order) return apiError("not_found", "הזמנה לא נמצאה", 404);

  const sessionOwns = sessionIsCustomer && session!.userId === order.customerId;
  if (!sessionOwns && !tokenMatches) {
    return apiError("forbidden", "אין הרשאה", 403);
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { reviewPromptDismissedAt: new Date() },
  });

  return apiJson({ ok: true });
});
