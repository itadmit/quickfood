import { handler, apiJson, apiError } from "@/lib/api-response";
import { OtpRequestSchema } from "@/lib/validate";
import { issueOtp } from "@/lib/auth/otp";
import { toE164 } from "@/lib/format";
import { prisma } from "@/lib/db/client";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import { checkRate } from "@/lib/api/rate-limit";
import { sanitizeMessageName } from "@/lib/safe-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("true-client-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export const POST = handler(async (req: Request) => {
  const body = OtpRequestSchema.parse(await req.json());
  const phone = toE164(body.phone);
  if (!phone) return apiError("validation_error", "מספר טלפון לא תקין", 422, "phone");

  // Abuse guard: this endpoint sends WhatsApp on the platform's managed account,
  // so an open, unthrottled send is a free spam relay. Cap per-phone and per-IP.
  checkRate(`otp:phone:${phone}`, 4);
  checkRate(`otp:ip:${clientIp(req)}`, 12);

  // Brand the message with the storefront's business name (bold on WhatsApp).
  const tenant = body.tenant_slug
    ? await prisma.tenant.findUnique({
        where: { slug: body.tenant_slug },
        select: { id: true, name: true, status: true },
      })
    : null;

  // Never relay for a suspended store, and never inject raw user-controlled
  // names (URLs / newlines) into the message body - that turns the OTP into
  // a spam carrier. sanitizeMessageName strips links and falls back to brand.
  if (tenant && tenant.status === "suspended") {
    return apiJson({ sent: true, expires_in: 0 });
  }

  const { code, expiresAt } = await issueOtp(phone);
  const businessName = sanitizeMessageName(tenant?.name ?? "QuickFood");
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
  const message = `*${businessName}:*\nקוד ההתחברות שלך הוא ${code}\nהקוד תקף ל-${minutes} דקות.`;

  // Send over QuickFood's platform WhatsApp (managed iBot account) - the
  // platform absorbs the cost, so it never draws the merchant's credit pool.
  let delivered = false;
  if (tenant) {
    try {
      const res = await sendWhatsApp({
        tenantId: tenant.id,
        to: phone,
        body: message,
        kind: "login_otp",
        useManagedAccount: true,
      });
      delivered = res.status === "sent";
    } catch (err) {
      console.error("[otp] whatsapp send failed", err);
    }
  }

  // Fallback so login still works when WhatsApp isn't configured (or no tenant
  // context) - mirrors the previous MVP behaviour.
  if (!delivered) {
    console.log(`[otp] ${phone} ← ${code}`);
  }

  return apiJson({
    sent: true,
    expires_in: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
});
