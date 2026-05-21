import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const t = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { smsCreditsRemaining: true, smsSender: true },
  });
  if (!t) return apiError("not_found", "tenant not found", 404);
  return apiJson({
    balance: {
      credits_remaining: t.smsCreditsRemaining,
      sender: t.smsSender,
    },
  });
});
