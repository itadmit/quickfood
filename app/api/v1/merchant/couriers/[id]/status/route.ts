import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z.object({
  status: z.enum(["available", "on_delivery", "break_time", "offline"]),
});

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const body = PatchSchema.parse(await req.json());
  const c = await prisma.courier.findUnique({ where: { id }, select: { tenantId: true } });
  if (!c) return apiError("not_found", "שליח לא נמצא", 404);
  if (c.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);
  const updated = await prisma.courier.update({ where: { id }, data: { status: body.status } });
  return apiJson({ courier: { id: updated.id, status: updated.status } });
});
