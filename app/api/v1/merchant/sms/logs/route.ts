import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));

  const logs = await prisma.smsLog.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      to: true,
      sender: true,
      body: true,
      kind: true,
      status: true,
      providerCode: true,
      providerMsg: true,
      sentAt: true,
      deliveredAt: true,
      createdAt: true,
    },
  });

  return apiJson({
    logs: logs.map((l) => ({
      id: l.id,
      to: l.to,
      sender: l.sender,
      body: l.body,
      kind: l.kind,
      status: l.status,
      provider_code: l.providerCode,
      provider_msg: l.providerMsg,
      sent_at: l.sentAt?.toISOString() ?? null,
      delivered_at: l.deliveredAt?.toISOString() ?? null,
      created_at: l.createdAt.toISOString(),
    })),
  });
});
