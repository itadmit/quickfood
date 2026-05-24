import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;

  const existing = await prisma.apiKey.findUnique({
    where: { id },
    select: { tenantId: true },
  });
  if (!existing) return apiError("not_found", "מפתח לא נמצא", 404);
  if (existing.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);

  await prisma.apiKey.delete({ where: { id } });
  return apiJson({ ok: true });
});
