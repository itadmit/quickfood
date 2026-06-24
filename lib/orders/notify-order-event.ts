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

function bodyFor(
  event: OrderNotifyEvent,
  ctx: {
    name: string;
    number: number | string;
    method: "delivery" | "pickup";
    courier: { name: string; phone: string | null } | null;
  },
): string {
  const { name, number } = ctx;
  switch (event) {
    case "confirmed":
      return `${name}: הזמנה ${number} התקבלה ואושרה. נעדכן אותך כשהיא מוכנה.`;
    case "ready":
      return ctx.method === "pickup"
        ? `${name}: הזמנה ${number} מוכנה לאיסוף! אפשר לבוא לקחת.`
        : `${name}: הזמנה ${number} מוכנה ותצא אליך בקרוב.`;
    case "on_the_way": {
      const courierLine = ctx.courier
        ? `השליח ${ctx.courier.name}${ctx.courier.phone ? ` (${ctx.courier.phone})` : ""}`
        : "השליח שלך";
      return `${name}: ${courierLine} יצא אליך עם הזמנה ${number}.`;
    }
    case "delivered":
      return `${name}: הזמנה ${number} נמסרה בהצלחה. בתאבון!`;
  }
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

  const body = bodyFor(event, {
    name: order.tenant.name,
    number: order.number,
    method: order.method,
    courier: order.courier,
  });

  await sendViaChannel(
    order.tenant,
    cfg.channel,
    order.customerPhoneSnap,
    body,
    `order_${event}`,
    orderId,
  );
}
