import { handler, apiJson, apiError } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { canResendVerification, sendVerificationEmail } from "@/lib/auth/email-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const session = await getSession();
  if (!session || session.type !== "merchant") {
    return apiError("unauthorized", "נדרשת התחברות", 401);
  }

  const user = await prisma.merchantUser.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
      tenantId: true,
      tenant: { select: { name: true } },
    },
  });
  if (!user) return apiError("unauthorized", "משתמש לא נמצא", 401);
  if (user.emailVerifiedAt) {
    return apiJson({ ok: true, alreadyVerified: true });
  }

  const allowed = await canResendVerification(user.id);
  if (!allowed) {
    return apiError("rate_limited", "נשלחו יותר מדי קישורי אימות. נסה שוב בעוד שעה.", 429);
  }

  await sendVerificationEmail({
    userId: user.id,
    email: user.email,
    ownerName: user.name,
    businessName: user.tenant?.name ?? "החנות שלך",
    tenantId: user.tenantId ?? null,
  });

  return apiJson({ ok: true });
});
