import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { getSubscription, BillingHubError } from "@/lib/billing-hub/client";
import { REVIEWS_WHATSAPP_BASE_PRICE } from "@/lib/billing-hub/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SmsSenderRegex = /^[A-Za-z0-9]{1,11}$/;

const Schema = z.object({
  enabled: z.boolean().optional(),
  public: z.boolean().optional(),
  channel: z
    .enum(["off", "email", "sms", "whatsapp", "whatsapp_managed"])
    .optional(),
  // Bounded between 5 minutes and 24 hours
  delay_minutes: z.number().int().min(5).max(1440).optional(),
  sms_sender: z
    .string()
    .max(11)
    .regex(SmsSenderRegex, "אותיות באנגלית או ספרות בלבד, עד 11 תווים")
    .nullable()
    .optional(),
});

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const t = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      reviewsEnabled: true,
      reviewsPublic: true,
      reviewsChannel: true,
      reviewsDelayMinutes: true,
      smsSender: true,
      reviewsWhatsappSubscriptionId: true,
      billingCustomerId: true,
      billingPaymentMethodId: true,
    },
  });
  if (!t) return apiError("not_found", "tenant not found", 404);

  // Enrich with live subscription status for the managed-WhatsApp add-on so
  // the form can render "פעיל · יחודש ב-XX/YY" or "ממתין לסיום תקופה" without
  // a second round trip. On hub error fall back to "active mirrored locally".
  const managed = {
    active: !!t.reviewsWhatsappSubscriptionId,
    subscription_id: t.reviewsWhatsappSubscriptionId,
    status: null as string | null,
    cancel_at_period_end: false,
    current_period_end: null as string | null,
    base_price: REVIEWS_WHATSAPP_BASE_PRICE,
  };
  if (t.reviewsWhatsappSubscriptionId) {
    try {
      const detail = await getSubscription(t.reviewsWhatsappSubscriptionId);
      managed.status = detail.status;
      managed.cancel_at_period_end = detail.cancel_at_period_end;
      managed.current_period_end = detail.current_period_end;
    } catch (err) {
      if (!(err instanceof BillingHubError)) throw err;
    }
  }

  return apiJson({
    settings: {
      enabled: t.reviewsEnabled,
      public: t.reviewsPublic,
      channel: t.reviewsChannel,
      delay_minutes: t.reviewsDelayMinutes,
      sms_sender: t.smsSender,
    },
    whatsapp_managed: managed,
    billing_ready: !!(t.billingCustomerId && t.billingPaymentMethodId),
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Schema.parse(await req.json());

  // Managed-WhatsApp channel needs an active add-on subscription. We mirror
  // the id locally on subscribe + webhook; if it's missing the merchant has
  // not paid for it (or it was cancelled and the period ended).
  if (body.channel === "whatsapp_managed") {
    const t = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { reviewsWhatsappSubscriptionId: true },
    });
    if (!t) return apiError("not_found", "tenant not found", 404);
    if (!t.reviewsWhatsappSubscriptionId) {
      return apiError(
        "whatsapp_managed_inactive",
        "מנוי ווטסאפ ביקורות אינו פעיל. הפעל את המנוי כדי לבחור בערוץ הזה.",
        409,
        "channel",
      );
    }
  }

  // Defense-in-depth: even though the UI disables them, a forged PATCH
  // must not silently switch to a paid channel the tenant can't actually
  // use. Check credits + whatsapp config before allowing the change.
  if (body.channel === "sms" || body.channel === "whatsapp") {
    const [tenant, platform] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: session.tenantId },
        select: {
          smsCreditsRemaining: true,
          whatsappToken: true,
          whatsappInstanceId: true,
        },
      }),
      prisma.platformSettings.findFirst({
        select: { whatsappDefaultToken: true, whatsappDefaultInstanceId: true },
      }),
    ]);
    if (!tenant) return apiError("not_found", "tenant not found", 404);
    if (tenant.smsCreditsRemaining <= 0) {
      return apiError(
        "no_credits",
        "אין קרדיט SMS. רכוש קרדיט כדי להפעיל את הערוץ הזה.",
        409,
        "channel",
      );
    }
    if (body.channel === "whatsapp") {
      const tenantConnected =
        !!(tenant.whatsappToken && tenant.whatsappInstanceId);
      const platformConnected =
        !!(platform?.whatsappDefaultToken && platform?.whatsappDefaultInstanceId);
      if (!tenantConnected && !platformConnected) {
        return apiError(
          "whatsapp_not_connected",
          "WhatsApp לא מחובר. הגדר חיבור בהגדרות WhatsApp לפני בחירת הערוץ.",
          409,
          "channel",
        );
      }
    }
  }

  const updated = await prisma.tenant.update({
    where: { id: session.tenantId },
    data: {
      ...(body.enabled !== undefined && { reviewsEnabled: body.enabled }),
      ...(body.public !== undefined && { reviewsPublic: body.public }),
      ...(body.channel !== undefined && { reviewsChannel: body.channel }),
      ...(body.delay_minutes !== undefined && { reviewsDelayMinutes: body.delay_minutes }),
      ...(body.sms_sender !== undefined && { smsSender: body.sms_sender }),
    },
    select: {
      reviewsEnabled: true,
      reviewsPublic: true,
      reviewsChannel: true,
      reviewsDelayMinutes: true,
      smsSender: true,
    },
  });

  return apiJson({
    settings: {
      enabled: updated.reviewsEnabled,
      public: updated.reviewsPublic,
      channel: updated.reviewsChannel,
      delay_minutes: updated.reviewsDelayMinutes,
      sms_sender: updated.smsSender,
    },
  });
});
