import { z } from "zod";
import { Prisma } from "@prisma/client";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Input = z.object({ email: z.string().trim().toLowerCase().email("כתובת מייל לא תקינה").max(254) });

export const PATCH = handler(async (req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) => {
  await requireAdmin();
  const { id: tenantId, userId } = await params;
  const { email } = Input.parse(await req.json());
  const user = await prisma.merchantUser.findFirst({ where: { id: userId, tenantId } });
  if (!user) return apiError("not_found", "משתמש לא נמצא", 404);
  if (user.email === email) return apiJson({ ok: true, email, email_verified_at: user.emailVerifiedAt?.toISOString() ?? null });
  const duplicate = await prisma.merchantUser.findFirst({ where: { email: { equals: email, mode: "insensitive" }, id: { not: userId } }, select: { id: true } });
  if (duplicate) return apiError("email_exists", "כתובת המייל כבר משויכת למשתמש אחר", 409);
  try {
    const now = new Date();
    await prisma.$transaction([
      prisma.merchantUser.update({ where: { id: userId }, data: { email, emailVerifiedAt: null } }),
      prisma.emailVerificationToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
      prisma.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
    ]);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return apiError("email_exists", "כתובת המייל כבר משויכת למשתמש אחר", 409);
    throw err;
  }
  return apiJson({ ok: true, email, email_verified_at: null });
});
