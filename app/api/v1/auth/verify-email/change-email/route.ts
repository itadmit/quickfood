import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { canResendVerification, sendVerificationEmail } from "@/lib/auth/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ChangeEmailSchema = z.object({
  email: z.string().email("כתובת מייל לא תקינה").max(160),
});

export const POST = handler(async (req: Request) => {
  const session = await getSession();
  if (!session || session.type !== "merchant") {
    return apiError("unauthorized", "נדרשת התחברות", 401);
  }

  const body = ChangeEmailSchema.parse(await req.json());
  const newEmail = body.email.trim().toLowerCase();

  const user = await prisma.merchantUser.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      tenantId: true,
      tenant: { select: { name: true } },
    },
  });
  if (!user) return apiError("unauthorized", "משתמש לא נמצא", 401);

  if (newEmail === user.email) {
    return apiError("validation_error", "זו אותה כתובת מייל", 422, "email");
  }

  const existing = await prisma.merchantUser.findUnique({ where: { email: newEmail } });
  if (existing) {
    return apiError("validation_error", "כתובת המייל כבר רשומה במערכת", 409, "email");
  }

  const allowed = await canResendVerification(user.id);
  if (!allowed) {
    return apiError("rate_limited", "נשלחו יותר מדי קישורי אימות. נסה שוב בעוד שעה.", 429);
  }

  // Update the email, force re-verification, and burn any previously-issued
  // tokens so a stolen link to the old address can't still work.
  await prisma.$transaction([
    prisma.merchantUser.update({
      where: { id: user.id },
      data: { email: newEmail, emailVerifiedAt: null },
    }),
    prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  await sendVerificationEmail({
    userId: user.id,
    email: newEmail,
    ownerName: user.name,
    businessName: user.tenant?.name ?? "החנות שלך",
    tenantId: user.tenantId ?? null,
  });

  return apiJson({ ok: true, email: newEmail });
});
