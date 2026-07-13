/**
 * Unified messaging settings for the "דיוור" hub.
 *
 * Replaces the old split between /settings/notifications (single order channel)
 * and /settings/reviews (review channel + delay + sender). Reads/writes:
 *   - per-event order notifications  → Tenant.notifySettings (JSON)
 *   - review reminder channel/delay  → Tenant.reviewsChannel / reviewsDelayMinutes
 *   - reviews master + public toggles → Tenant.reviewsEnabled / reviewsPublic
 *   - SMS sender name                → Tenant.smsSender
 *
 * The legacy `notifyChannel` column is kept (the resolver falls back to it for
 * tenants who never opened this screen) but is no longer written here.
 */
import { z } from "zod";
import { handler, apiJson, apiError } from "@/lib/api-response";
import { requireMerchant } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/client";
import { getSubscription, BillingHubError } from "@/lib/billing-hub/client";
import { REVIEWS_WHATSAPP_BASE_PRICE } from "@/lib/billing-hub/plans";
import { resolveMessagingAvailability } from "@/lib/messaging/availability";
import {
  resolveOrderNotifySettings,
  resolveMerchantNewOrderSettings,
  ORDER_NOTIFY_EVENTS,
  type OrderNotifySettings,
  type NotifyChannel,
} from "@/lib/messaging/notify-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SmsSenderRegex = /^[A-Za-z0-9]{1,11}$/;
const ChannelEnum = z.enum(["off", "email", "sms", "whatsapp", "whatsapp_managed"]);
const EventEnum = z.enum(["confirmed", "ready", "on_the_way", "delivered"]);

const Schema = z.object({
  order_events: z
    .record(
      EventEnum,
      z.object({
        enabled: z.boolean(),
        channel: ChannelEnum,
        text: z.string().max(1000).nullish(),
      }),
    )
    .optional(),
  review: z
    .object({
      enabled: z.boolean().optional(),
      public: z.boolean().optional(),
      channel: ChannelEnum.optional(),
      delay_minutes: z.number().int().min(5).max(1440).optional(),
    })
    .optional(),
  sms_sender: z
    .string()
    .max(11)
    .regex(SmsSenderRegex, "אותיות באנגלית או ספרות בלבד, עד 11 תווים")
    .nullable()
    .optional(),
  merchant_new_order: z
    .object({
      email: z.boolean(),
      whatsapp: z.boolean(),
    })
    .optional(),
});

async function loadContext(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      notifyChannel: true,
      notifySettings: true,
      reviewsEnabled: true,
      reviewsPublic: true,
      reviewsChannel: true,
      reviewsDelayMinutes: true,
      smsSender: true,
      smsCreditsRemaining: true,
      whatsappCreditsRemaining: true,
      whatsappEnabled: true,
      whatsappToken: true,
      whatsappInstanceId: true,
      reviewsWhatsappSubscriptionId: true,
      billingCustomerId: true,
      billingPaymentMethodId: true,
    },
  });
  if (!tenant) return null;
  const a = resolveMessagingAvailability(tenant);
  return {
    tenant,
    sms_available: a.smsAvailable,
    whatsapp_enabled: a.whatsappEnabled,
    whatsapp_connected: a.whatsappConnected,
    whatsapp_available: a.whatsappAvailable,
    whatsapp_credits: a.whatsappCredits,
    managed_active: a.managedActive,
  };
}

/** Reject a paid channel the tenant can't actually use (defense-in-depth). */
function channelError(
  channel: NotifyChannel,
  ctx: {
    sms_available: boolean;
    whatsapp_connected: boolean;
    whatsapp_available: boolean;
    managed_active: boolean;
  },
) {
  if (channel === "whatsapp_managed" && !ctx.managed_active) {
    return apiError(
      "whatsapp_managed_inactive",
      "מנוי ווטסאפ של QuickFood אינו פעיל. הפעילו אותו כדי לבחור בערוץ הזה.",
      409,
      "channel",
    );
  }
  if (channel === "sms" && !ctx.sms_available) {
    return apiError("no_credits", "אין יתרת SMS. רכשו חבילה כדי להפעיל את הערוץ הזה.", 409, "channel");
  }
  if (channel === "whatsapp") {
    if (!ctx.whatsapp_connected) {
      return apiError("whatsapp_not_connected", "WhatsApp לא מחובר. חברו את ה-iBot בעמוד 'דיוור והתראות'.", 409, "channel");
    }
    if (!ctx.whatsapp_available) {
      return apiError("no_credits", "אין יתרת וואטסאפ. רכשו חבילת וואטסאפ כדי להפעיל את הערוץ הזה.", 409, "channel");
    }
  }
  return null;
}

async function managedDetail(subId: string | null) {
  const managed = {
    active: !!subId,
    cancel_at_period_end: false,
    current_period_end: null as string | null,
    base_price: REVIEWS_WHATSAPP_BASE_PRICE,
  };
  if (subId) {
    try {
      const detail = await getSubscription(subId);
      managed.cancel_at_period_end = detail.cancel_at_period_end;
      managed.current_period_end = detail.current_period_end;
    } catch (err) {
      if (!(err instanceof BillingHubError)) throw err;
    }
  }
  return managed;
}

export const GET = handler(async () => {
  const session = await requireMerchant();
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const ctx = await loadContext(session.tenantId);
  if (!ctx) return apiError("not_found", "tenant not found", 404);
  const { tenant } = ctx;

  const orderEvents = resolveOrderNotifySettings(
    tenant.notifySettings,
    tenant.notifyChannel,
  );

  return apiJson({
    balance: tenant.smsCreditsRemaining,
    whatsapp_balance: tenant.whatsappCreditsRemaining,
    sms_sender: tenant.smsSender,
    billing_ready: !!(tenant.billingCustomerId && tenant.billingPaymentMethodId),
    whatsapp: {
      token: tenant.whatsappToken ?? "",
      instance_id: tenant.whatsappInstanceId ?? "",
    },
    order_events: orderEvents,
    merchant_new_order: resolveMerchantNewOrderSettings(tenant.notifySettings),
    review: {
      enabled: tenant.reviewsEnabled,
      public: tenant.reviewsPublic,
      channel: tenant.reviewsChannel,
      delay_minutes: tenant.reviewsDelayMinutes,
    },
    availability: {
      sms_available: ctx.sms_available,
      whatsapp_enabled: ctx.whatsapp_enabled,
      whatsapp_connected: ctx.whatsapp_connected,
      whatsapp_available: ctx.whatsapp_available,
      whatsapp_credits: ctx.whatsapp_credits,
      managed_active: ctx.managed_active,
    },
    whatsapp_managed: await managedDetail(tenant.reviewsWhatsappSubscriptionId),
  });
});

export const PATCH = handler(async (req: Request) => {
  const session = await requireMerchant(["owner", "manager"]);
  if (!session.tenantId) return apiError("forbidden", "no tenant", 403);
  const body = Schema.parse(await req.json());

  const ctx = await loadContext(session.tenantId);
  if (!ctx) return apiError("not_found", "tenant not found", 404);
  const { tenant } = ctx;

  // Validate every channel that is being enabled.
  if (body.order_events) {
    for (const ev of ORDER_NOTIFY_EVENTS) {
      const e = body.order_events[ev];
      if (e?.enabled && e.channel !== "off" && e.channel !== "email") {
        const err = channelError(e.channel, ctx);
        if (err) return err;
      }
    }
  }
  if (body.review?.channel && body.review.channel !== "off" && body.review.channel !== "email") {
    const err = channelError(body.review.channel, ctx);
    if (err) return err;
  }

  // Merge order-event changes over the resolved current state, then store the
  // full object so future reads don't depend on the legacy column. The JSON
  // also carries merchant_new_order - always rewrite BOTH parts so saving one
  // never drops the other.
  const data: Record<string, unknown> = {};
  if (body.order_events || body.merchant_new_order) {
    const next: OrderNotifySettings = {
      ...resolveOrderNotifySettings(tenant.notifySettings, tenant.notifyChannel),
    };
    if (body.order_events) {
      for (const ev of ORDER_NOTIFY_EVENTS) {
        const e = body.order_events[ev];
        if (e) {
          const text = e.text?.trim();
          next[ev] = { enabled: e.enabled, channel: e.channel, text: text ? text : null };
        }
      }
    }
    data.notifySettings = {
      ...next,
      merchant_new_order:
        body.merchant_new_order ?? resolveMerchantNewOrderSettings(tenant.notifySettings),
    };
  }
  if (body.review?.enabled !== undefined) data.reviewsEnabled = body.review.enabled;
  if (body.review?.public !== undefined) data.reviewsPublic = body.review.public;
  if (body.review?.channel !== undefined) data.reviewsChannel = body.review.channel;
  if (body.review?.delay_minutes !== undefined) data.reviewsDelayMinutes = body.review.delay_minutes;
  if (body.sms_sender !== undefined) data.smsSender = body.sms_sender;

  if (Object.keys(data).length > 0) {
    await prisma.tenant.update({ where: { id: session.tenantId }, data });
  }

  return apiJson({ ok: true });
});
