import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (
    _req: Request,
    { params }: { params: Promise<{ id: string; userId: string }> },
  ) => {
    await requireAdmin();
    const { id: tenantId, userId } = await params;

    const user = await prisma.merchantUser.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, emailVerifiedAt: true },
    });
    if (!user) return apiError("not_found", "משתמש לא נמצא", 404);
    if (user.tenantId !== tenantId) {
      return apiError("forbidden", "המשתמש לא שייך למסעדה הזו", 403);
    }
    if (user.emailVerifiedAt) {
      return apiJson({ ok: true, already_verified: true, verified_at: user.emailVerifiedAt.toISOString() });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.merchantUser.update({
        where: { id: userId },
        data: { emailVerifiedAt: now },
      }),
      prisma.emailVerificationToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    return apiJson({ ok: true, verified_at: now.toISOString() });
  },
);

export const DELETE = handler(
  async (
    _req: Request,
    { params }: { params: Promise<{ id: string; userId: string }> },
  ) => {
    await requireAdmin();
    const { id: tenantId, userId } = await params;

    const user = await prisma.merchantUser.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!user) return apiError("not_found", "משתמש לא נמצא", 404);
    if (user.tenantId !== tenantId) {
      return apiError("forbidden", "המשתמש לא שייך למסעדה הזו", 403);
    }

    await prisma.merchantUser.update({
      where: { id: userId },
      data: { emailVerifiedAt: null },
    });

    return apiJson({ ok: true });
  },
);
