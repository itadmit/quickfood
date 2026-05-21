/**
 * Admin-driven password reset.
 *
 * Lets a platform admin set a new password for any merchant user on any
 * tenant — bypassing the email-token flow (used for support: phone calls,
 * lost emails). Also invalidates any outstanding reset tokens for that
 * user so an old "forgot password" email can't be redeemed after the
 * admin has changed it.
 *
 * Body: `{ password: string }` — min 8 chars. Returns `{ ok: true }`.
 */
import { z } from "zod";
import bcrypt from "bcryptjs";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  password: z.string().min(8).max(200),
});

export const POST = handler(
  async (
    req: Request,
    { params }: { params: Promise<{ id: string; userId: string }> },
  ) => {
    await requireAdmin();
    const { id: tenantId, userId } = await params;
    const { password } = Schema.parse(await req.json());

    const user = await prisma.merchantUser.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!user) return apiError("not_found", "משתמש לא נמצא", 404);
    if (user.tenantId !== tenantId) {
      return apiError("forbidden", "המשתמש לא שייך למסעדה הזו", 403);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.merchantUser.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      // Burn any outstanding "forgot password" tokens so an old email can't
      // be redeemed after the admin override.
      prisma.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    return apiJson({ ok: true });
  },
);
