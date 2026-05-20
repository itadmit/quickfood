import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Patch = z.object({ status: z.enum(["active", "suspended", "trial"]) });

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;
  const body = Patch.parse(await req.json());
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
  if (!tenant) return apiError("not_found", "מסעדה לא נמצאה", 404);
  const updated = await prisma.tenant.update({ where: { id }, data: { status: body.status } });
  return apiJson({ tenant: { id: updated.id, status: updated.status } });
});
