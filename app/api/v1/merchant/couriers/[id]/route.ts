import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PatchSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    phone: z.string().min(7).max(20).optional(),
    email: z.string().email().max(160).optional(),
    vehicle: z.enum(["scooter", "bike", "car", "walking"]).optional(),
    max_concurrent: z.number().int().min(1).max(10).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "no fields to update" });

export const PATCH = handler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireMerchant(["owner", "manager"]);
    if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
    const { id } = await params;
    const c = await prisma.courier.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!c) return apiError("not_found", "שליח לא נמצא", 404);
    if (c.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);
    const body = PatchSchema.parse(await req.json());

    if (body.email) {
      const email = body.email.trim().toLowerCase();
      const dup = await prisma.courier.findFirst({
        where: { email, NOT: { id } },
        select: { id: true },
      });
      if (dup) return apiError("conflict", "כבר קיים שליח עם המייל הזה", 409, "email");
    }

    const updated = await prisma.courier.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.phone ? { phone: body.phone.replace(/[^\d]/g, "") } : {}),
        ...(body.email ? { email: body.email.trim().toLowerCase() } : {}),
        ...(body.vehicle ? { vehicle: body.vehicle } : {}),
        ...(typeof body.max_concurrent === "number" ? { maxConcurrent: body.max_concurrent } : {}),
      },
    });
    return apiJson({
      courier: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
      },
    });
  },
);

export const DELETE = handler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const { id } = await params;
  const c = await prisma.courier.findUnique({
    where: { id },
    select: { tenantId: true },
  });
  if (!c) return apiError("not_found", "שליח לא נמצא", 404);
  if (c.tenantId !== session.tenantId) return apiError("forbidden", "אין הרשאה", 403);

  await prisma.$transaction([
    prisma.courier.update({
      where: { id },
      data: { active: false, status: "offline" },
    }),
    prisma.courierSession.updateMany({
      where: { courierId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return apiJson({ ok: true });
});
