/**
 * POST /api/v1/customer/kiosk-otp/request
 *
 * Issues a 6-digit OTP for the kiosk phone-verification step and dispatches
 * it via WhatsApp first (cheaper + richer link preview), falling back to
 * SMS via sms4free if WhatsApp isn't configured or fails. Re-uses the
 * existing `issueOtp` helper + OtpCode table so any rate-limiting + retry
 * logic stays in one place.
 *
 * Gating:
 *   - Tenant must exist and have kioskEnabled=true.
 *   - Tenant must have kioskRequirePhone=true (no point spamming codes
 *     when the kiosk doesn't even ask for a phone).
 *   - Throttle: if there's an unused, unexpired OtpCode for this phone
 *     from the last 60s we skip re-issuing — protects against double-tap
 *     button mashing AND from a wall-of-OTPs DoS.
 *
 * No session is created; the verify endpoint also doesn't issue tokens.
 * The kiosk runs anonymous; verification is just "this phone is real".
 */

import { z } from "zod";
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { toE164 } from "@/lib/format";
import { issueOtp } from "@/lib/auth/otp";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import { sendSms } from "@/lib/sms/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  tenant_slug: z.string().min(1),
  phone: z.string().min(3).max(20),
});

const THROTTLE_SECONDS = 60;

export const POST = handler(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError("invalid_body", "פרטים לא תקינים", 422);
  }

  const e164 = toE164(parsed.data.phone);
  if (!e164) {
    return apiError("invalid_phone", "מספר טלפון לא תקין", 422, "phone");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: parsed.data.tenant_slug },
    select: { id: true, name: true, kioskEnabled: true, kioskRequirePhone: true },
  });
  if (!tenant) return apiError("tenant_not_found", "מסעדה לא נמצאה", 404);
  if (!tenant.kioskEnabled) {
    return apiError("kiosk_disabled", "קיוסק לא פעיל", 403);
  }
  if (!tenant.kioskRequirePhone) {
    return apiError("otp_disabled", "אימות OTP לא פעיל לקיוסק זה", 403);
  }

  // Throttle — if we issued a code less than THROTTLE_SECONDS ago and
  // it's still valid, return early with a "resend in N seconds" hint.
  // This guards against accidental double-clicks AND against a kiosk
  // attacker spamming the platform's WhatsApp/SMS budget.
  const recent = await prisma.otpCode.findFirst({
    where: {
      phone: e164,
      usedAt: null,
      expiresAt: { gt: new Date() },
      createdAt: { gt: new Date(Date.now() - THROTTLE_SECONDS * 1000) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, expiresAt: true },
  });
  if (recent) {
    const waitSeconds = Math.max(
      1,
      THROTTLE_SECONDS -
        Math.floor((Date.now() - recent.createdAt.getTime()) / 1000),
    );
    return apiJson({
      sent: true,
      throttled: true,
      retry_in: waitSeconds,
      expires_in: Math.max(
        0,
        Math.floor((recent.expiresAt.getTime() - Date.now()) / 1000),
      ),
    });
  }

  const { code, expiresAt } = await issueOtp(e164);
  const body =
    `${tenant.name} · קוד אימות: ${code}\n` +
    `הקוד תקף ל-10 דקות. אם לא ביקשת — אפשר להתעלם.`;

  // Try WhatsApp first. sendWhatsApp auto-falls-back to the platform
  // default iBot account when the tenant hasn't connected their own.
  let channel: "whatsapp" | "sms" | null = null;
  let lastProviderMsg = "";
  try {
    const wa = await sendWhatsApp({
      tenantId: tenant.id,
      to: e164,
      body,
      kind: "kiosk_otp",
      refKind: "phone",
      refId: e164,
      // OTP delivery shouldn't burn the merchant's SMS budget — codes
      // are a platform-level UX feature, not a marketing message.
      skipCredit: true,
    });
    if (wa.status === "sent") channel = "whatsapp";
    else lastProviderMsg = wa.providerMsg ?? wa.status;
  } catch (err) {
    lastProviderMsg = err instanceof Error ? err.message : "whatsapp_error";
  }

  if (!channel) {
    try {
      const sms = await sendSms({
        tenantId: tenant.id,
        to: e164,
        body,
        kind: "kiosk_otp",
        refKind: "phone",
        refId: e164,
        skipCredit: true,
      });
      if (sms.status === "sent") channel = "sms";
      else lastProviderMsg = sms.providerMsg ?? sms.status;
    } catch (err) {
      lastProviderMsg = err instanceof Error ? err.message : "sms_error";
    }
  }

  if (!channel) {
    return apiError(
      "delivery_failed",
      "לא הצלחנו לשלוח קוד אימות. נסו שוב או פנו לקופה.",
      502,
    );
  }

  return apiJson({
    sent: true,
    channel,
    expires_in: Math.max(
      0,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    ),
    provider_msg: lastProviderMsg || undefined,
  });
});
