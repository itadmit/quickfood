import { z } from "zod";
import crypto from "node:crypto";
import { handler, apiJson } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_TTL_MINUTES = 30;

const ForgotSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /api/v1/auth/forgot-password
 *
 * Always returns 200 with the same generic message - we never confirm or deny
 * whether an email exists, to avoid leaking account enumeration. The actual
 * reset URL is delivered only via email.
 */
export const POST = handler(async (req: Request) => {
  const { email } = ForgotSchema.parse(await req.json());
  const normalized = email.trim().toLowerCase();

  const user = await prisma.merchantUser.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, email: true, tenantId: true },
  });

  // Best-effort: only issue+send when the user actually exists. If we get
  // back nothing, we still reply with the generic success message below.
  if (user && user.tenantId) {
    const rawToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
    const resetUrl = `${appUrl}/dashboard/reset-password?token=${rawToken}`;
    const { html, text } = passwordResetEmail({
      ownerName: user.name,
      resetUrl,
      expiresInMinutes: TOKEN_TTL_MINUTES,
    });

    try {
      await sendEmail({
        tenantId: user.tenantId,
        to: user.email,
        subject: "איפוס סיסמה ל-QuickFood",
        body: text,
        html,
        kind: "password_reset",
        refKind: "merchant_user",
        refId: user.id,
      });
    } catch (err) {
      console.warn("[forgot-password] email send failed", err);
    }
  }

  return apiJson({ ok: true });
});
