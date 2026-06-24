/**
 * Transactional order notifications to the customer over the tenant's chosen
 * paid channel (`notifyChannel`), sent IN ADDITION to any email.
 *
 * Channel resolution mirrors lib/reviews/send-now.ts:
 *   - sms              → sendSms (draws the SMS/WhatsApp credit pool)
 *   - whatsapp         → sendWhatsApp (own iBot creds, else platform default;
 *                        draws the credit pool)
 *   - whatsapp_managed → sendWhatsApp(useManagedAccount) (platform iBot
 *                        account, requires the managed-WhatsApp add-on)
 *   - email / off      → no paid send (email is handled by its own templates)
 *
 * Best-effort and non-throwing: every caller fires it inside after()/void.
 */
import { prisma } from "@/lib/db/client";
import { sendSms } from "@/lib/sms/send";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import {
  resolveOrderNotifySettings,
  type NotifyChannel,
  type OrderNotifyEvent,
} from "@/lib/messaging/notify-settings";

export type { OrderNotifyEvent };

interface TenantChannel {
  id: string;
  name: string;
  reviewsWhatsappSubscriptionId: string | null;
}

async function sendViaChannel(
  tenant: TenantChannel,
  ch: NotifyChannel,
  to: string,
  body: string,
  kind: string,
  refId: string,
): Promise<void> {
  if (ch === "off" || ch === "email") return;

  if (ch === "whatsapp_managed") {
    // Paid managed add-on; if it isn't active, skip (no silent fallback to
    // the merchant's own pool).
    if (!tenant.reviewsWhatsappSubscriptionId) return;
    await sendWhatsApp({
      tenantId: tenant.id,
      to,
      body,
      kind,
      refKind: "order",
      refId,
      useManagedAccount: true,
    });
    return;
  }

  if (ch === "whatsapp") {
    await sendWhatsApp({
      tenantId: tenant.id,
      to,
      body,
      kind,
      refKind: "order",
      refId,
    });
    return;
  }

  await sendSms({ tenantId: tenant.id, to, body, kind, refKind: "order", refId });
}

interface BodyCtx {
  name: string;
  number: number | string;
  method: "delivery" | "pickup";
  courier: { name: string; phone: string | null } | null;
  waze: string | null;
}

/** Tokens a merchant may use in an override text. */
function templateVars(ctx: BodyCtx): Record<string, string> {
  return {
    business: ctx.name,
    order: String(ctx.number),
    courier: ctx.courier?.name ?? "",
    courier_phone: ctx.courier?.phone ?? "",
    waze: ctx.waze ?? "",
  };
}

export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? vars[key] : m))
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Built-in defaults. SMS stays short and plain (every char is billed). WhatsApp
 * gets a richer copy: a light emoji, a Waze link on pickup-ready, no long dashes.
 */
function defaultBody(
  event: OrderNotifyEvent,
  ctx: BodyCtx,
  channel: NotifyChannel,
): string {
  const { name, number } = ctx;
  const rich = channel === "whatsapp" || channel === "whatsapp_managed";
  switch (event) {
    case "confirmed":
      return rich
        ? `${name}\nהזמנה ${number} התקבלה ואושרה ✅\nנעדכן אותך כשהיא מוכנה.`
        : `${name}: הזמנה ${number} התקבלה ואושרה. נעדכן אותך כשהיא מוכנה.`;
    case "ready":
      if (ctx.method === "pickup") {
        if (rich) {
          const wazeLine = ctx.waze ? `\nניווט במפה: ${ctx.waze}` : "";
          return `${name}\nהזמנה ${number} מוכנה לאיסוף 🛍️\nאפשר לבוא לקחת!${wazeLine}`;
        }
        return `${name}: הזמנה ${number} מוכנה לאיסוף! אפשר לבוא לקחת.`;
      }
      return rich
        ? `${name}\nהזמנה ${number} מוכנה 🛍️\nתצא אליך בקרוב.`
        : `${name}: הזמנה ${number} מוכנה ותצא אליך בקרוב.`;
    case "on_the_way": {
      const courierLine = ctx.courier
        ? `השליח ${ctx.courier.name}${ctx.courier.phone ? ` (${ctx.courier.phone})` : ""}`
        : "השליח שלך";
      return rich
        ? `${name}\n${courierLine} יצא אליך עם הזמנה ${number} 🛵`
        : `${name}: ${courierLine} יצא אליך עם הזמנה ${number}.`;
    }
    case "delivered":
      return rich
        ? `${name}\nהזמנה ${number} נמסרה בהצלחה 🎉\nבתאבון!`
        : `${name}: הזמנה ${number} נמסרה בהצלחה. בתאבון!`;
  }
}

function bodyFor(
  event: OrderNotifyEvent,
  ctx: BodyCtx,
  channel: NotifyChannel,
  override: string | null | undefined,
): string {
  if (override && override.trim().length > 0) {
    return renderTemplate(override, templateVars(ctx));
  }
  return defaultBody(event, ctx, channel);
}

/** Waze deep link to the restaurant - coords win, else a text address query. */
function wazeLink(
  branch: { address: string | null; lat: unknown; lng: unknown } | null,
): string | null {
  if (!branch) return null;
  const lat = branch.lat == null ? null : Number(branch.lat);
  const lng = branch.lng == null ? null : Number(branch.lng);
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  if (branch.address && branch.address.trim().length > 0) {
    return `https://waze.com/ul?q=${encodeURIComponent(branch.address.trim())}`;
  }
  return null;
}

export async function notifyOrderCustomer(
  orderId: string,
  event: OrderNotifyEvent,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      method: true,
      customerPhoneSnap: true,
      courier: { select: { name: true, phone: true } },
      branch: { select: { address: true, lat: true, lng: true } },
      tenant: {
        select: {
          id: true,
          name: true,
          notifyChannel: true,
          notifySettings: true,
          reviewsWhatsappSubscriptionId: true,
        },
      },
    },
  });
  if (!order?.customerPhoneSnap) return;

  const settings = resolveOrderNotifySettings(
    order.tenant.notifySettings,
    order.tenant.notifyChannel,
  );
  const cfg = settings[event];
  if (!cfg.enabled) return;

  const body = bodyFor(
    event,
    {
      name: order.tenant.name,
      number: order.number,
      method: order.method,
      courier: order.courier,
      waze: wazeLink(order.branch),
    },
    cfg.channel,
    cfg.text,
  );

  await sendViaChannel(
    order.tenant,
    cfg.channel,
    order.customerPhoneSnap,
    body,
    `order_${event}`,
    orderId,
  );
}
