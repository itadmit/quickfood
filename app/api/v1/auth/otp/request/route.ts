import { handler, apiJson, apiError } from "@/lib/api-response";
import { OtpRequestSchema } from "@/lib/validate";
import { issueOtp } from "@/lib/auth/otp";
import { toE164 } from "@/lib/format";
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { otpEmail } from "@/lib/email/templates";
import { checkRate } from "@/lib/api/rate-limit";
import { sanitizeMessageName } from "@/lib/safe-text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** `danny@gmail.com` → `d***y@gmail.com`. Enough to recognise, not enough to
 *  hand a stranger the address behind someone else's phone number. */
function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  const head = local.slice(0, 1);
  const tail = local.length > 2 ? local.slice(-1) : "";
  return `${head}***${tail}@${domain}`;
}

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

  // Customer login is members-only, so the store context is required - a code
  // is only ever sent to a phone that has joined THIS store's club.
  if (!body.tenant_slug) {
    return apiError("validation_error", "חסר מזהה חנות", 422, "tenant_slug");
  }
  const tenant = await prisma.tenant.findUnique({
    where: { slug: body.tenant_slug },
    select: { id: true, name: true, status: true },
  });
  if (!tenant) return apiError("not_found", "החנות לא נמצאה", 404, "tenant_slug");

  // Never relay for a suspended store, and never inject raw user-controlled
  // names (URLs / newlines) into the message body - that turns the OTP into
  // a spam carrier. sanitizeMessageName strips links and falls back to brand.
  if (tenant.status === "suspended") {
    return apiJson({ sent: true, expires_in: 0 });
  }

  // Only send to a registered club member of THIS store. joinSource != auto
  // excludes legacy auto-enrol rows (customers who only ordered as guests).
  // Membership is per-tenant, so the same phone can belong to other stores'
  // clubs without leaking a code here. Never create a new customer.
  const member = await prisma.loyaltyMember.findFirst({
    where: { tenantId: tenant.id, joinSource: { not: "auto" }, customer: { phone } },
    select: { id: true, customer: { select: { id: true, email: true } } },
  });
  if (!member) {
    return apiError("not_member", "אין מנוי עם מספר זה", 404, "phone");
  }

  // Identity is still the phone — the member types it and `verifyOtp` keys the
  // code to it. Only the delivery channel changed: this used to go out over
  // the platform's unofficial iBot WhatsApp account, whose only fallback was
  // printing the code to a server log, i.e. no delivery at all.
  //
  // Email is required at loyalty-join, so a member enrolled after that always
  // has one. The handful who joined before it get a clear instruction rather
  // than a code that silently goes nowhere.
  const email = member.customer.email?.trim();
  if (!email) {
    return apiError(
      "email_missing",
      "אין כתובת מייל על המנוי הזה. פנו לחנות כדי להוסיף אותה, ואז תוכלו להתחבר.",
      409,
      "email",
    );
  }

  const { code, expiresAt } = await issueOtp(phone);
  const businessName = sanitizeMessageName(tenant.name);
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
  const { html, text } = otpEmail({
    code,
    expiresInMinutes: minutes,
    purpose: "customer_login",
    businessName,
  });

  await sendEmail({
    tenantId: tenant.id,
    to: email,
    subject: `${businessName} · קוד הכניסה שלך: ${code}`,
    body: text,
    html,
    kind: "login_otp",
    refKind: "customer",
    refId: member.customer.id,
  });

  return apiJson({
    sent: true,
    expires_in: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
    // The client masks this back to the member so they know which inbox to
    // open — a code that "was sent" to an address they forgot is a dead end.
    email_hint: maskEmail(email),
  });
});
