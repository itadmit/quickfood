import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ResetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(128),
});

/**
 * POST /api/v1/auth/reset-password
 *
 * Validates the one-time token (matched by SHA-256 hash, not the raw token),
 * sets the new password on the user, and marks the token used. The user is
 * NOT auto-logged-in — they go through the normal login flow next.
 */
export const POST = handler(async (req: Request) => {
  const { token, password } = ResetSchema.parse(await req.json());

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return apiError("invalid_token", "הקישור לא תקין או שפג תוקפו", 400, "token");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.merchantUser.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate any other outstanding tokens for the same user.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  return apiJson({ ok: true });
});
