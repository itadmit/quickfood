import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { issueEmailOtp, normalizeEmail } from "@/lib/auth/otp";
import { findMerchantByEmail } from "@/lib/auth/merchant-by-email";
import { sendEmail } from "@/lib/email/send";
import { otpEmail } from "@/lib/email/templates";
import { prisma } from "@/lib/db/client";
import { checkRate } from "@/lib/api/rate-limit";
import { hitDurable } from "@/lib/api/durable-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().email().max(160) });

const RESEND_THROTTLE_MS = 45_000;

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("true-client-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export const POST = handler(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return apiError("invalid_email", "כתובת מייל לא תקינה", 422, "email");

  const email = normalizeEmail(parsed.data.email);

  checkRate(`merchant-otp:ip:${clientIp(req)}`, 8);
  checkRate(`merchant-otp:email:${email}`, 4);
  if (!(await hitDurable(`merchant-otp:ip:${clientIp(req)}`, 10, 10 * 60_000))) {
    return apiError("rate_limited", "נחסמת זמנית עקב יותר מדי בקשות. נסו שוב בעוד כמה דקות.", 429);
  }

  // Always answer sent:true so the endpoint can't be used to probe which
  // addresses have an account.
  const merchant = await findMerchantByEmail(email);
  if (!merchant) return apiJson({ sent: true });

  const recent = await prisma.otpCode.findFirst({
    where: {
      email,
      usedAt: null,
      createdAt: { gt: new Date(Date.now() - RESEND_THROTTLE_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) return apiJson({ sent: true });

  const { code, expiresAt } = await issueEmailOtp(email);
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
  const { html, text } = otpEmail({ code, expiresInMinutes: minutes, purpose: "login" });

  await sendEmail({
    tenantId: merchant.tenantId,
    to: email,
    subject: `QuickFood · קוד האימות שלך: ${code}`,
    body: text,
    html,
    kind: "login_otp",
  });

  return apiJson({ sent: true });
});
