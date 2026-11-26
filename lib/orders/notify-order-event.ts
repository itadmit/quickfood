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
import { sendEmail } from "@/lib/email/send";
import { orderStatusEmail, renderRtlEmail } from "@/lib/email/templates";
import { appBaseUrl, formatScheduledFor } from "@/lib/orders/notify-customer";
import {
  resolveOrderNotifySettings,
  type NotifyChannel,
  type OrderNotifyEvent,
} from "@/lib/messaging/notify-settings";
import {
  defaultBody,
  renderTemplate,
  templateVars,
  type BodyCtx,
} from "@/lib/messaging/notify-templates";

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

  await sendSms({ tenantId: tenant.id, to, body, kind, refKind: "order", refId });
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
      total: true,
      customerPhoneSnap: true,
      customerFirstNameSnap: true,
      customerEmailSnap: true,
      customer: { select: { email: true } },
      courier: { select: { name: true, phone: true } },
      branch: { select: { address: true, lat: true, lng: true } },
      items: { select: { nameSnapshot: true, quantity: true } },
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true,
          notifyChannel: true,
          notifySettings: true,
          reviewsWhatsappSubscriptionId: true,
        },
      },
    },
  });
  if (!order) return;

  const settings = resolveOrderNotifySettings(
    order.tenant.notifySettings,
    order.tenant.notifyChannel,
  );
  const cfg = settings[event];
  if (!cfg.enabled) return;

  // Email is the free channel. `confirmed` already gets the always-on
  // confirmation email (sendOrderConfirmedEmail), so skip it here to avoid a
  // duplicate; only ready / on_the_way / delivered are sent from here.
  if (cfg.channel === "email") {
    if (event === "confirmed") return;
    const to =
      order.customerEmailSnap?.trim() || order.customer?.email?.trim() || null;
    if (!to) return;
    const { html, text, subject } = orderStatusEmail({
      event: event as "ready" | "on_the_way" | "delivered",
      customerName: order.customerFirstNameSnap?.trim() || "לקוח",
      businessName: order.tenant.name,
      orderNumber: order.number,
      method: order.method,
      trackingUrl: `${appBaseUrl()}/s/${order.tenant.slug}/orders/${order.id}`,
    });
    await sendEmail({
      tenantId: order.tenant.id,
      to,
      subject,
      body: text,
      html,
      fromName: order.tenant.name,
      kind: `order_${event}`,
      refKind: "order",
      refId: orderId,
    });
    return;
  }

  if (!order.customerPhoneSnap) return;

  const body = bodyFor(
    event,
    {
      name: order.tenant.name,
      number: order.number,
      method: order.method,
      courier: order.courier,
      waze: wazeLink(order.branch),
      customer: order.customerFirstNameSnap?.trim() || "",
      items: order.items.map((it) => `${it.quantity}× ${it.nameSnapshot}`).join("\n"),
      total: `₪${order.total}`,
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

export async function notifyOrderRescheduled(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        number: true,
        scheduledFor: true,
        customerPhoneSnap: true,
        customerFirstNameSnap: true,
        customerEmailSnap: true,
        customer: { select: { email: true } },
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true,
            notifyChannel: true,
            notifySettings: true,
            reviewsWhatsappSubscriptionId: true,
          },
        },
      },
    });
    if (!order) return;

    const settings = resolveOrderNotifySettings(
      order.tenant.notifySettings,
      order.tenant.notifyChannel,
    );
    const channel: NotifyChannel =
      settings.confirmed.channel !== "off"
        ? settings.confirmed.channel
        : (order.tenant.notifyChannel as NotifyChannel);
    if (channel === "off") return;

    const when = formatScheduledFor(order.scheduledFor);
    const line = when
      ? `ההזמנה ${order.number} תוזמנה מחדש ל${when}.`
      : `ההזמנה ${order.number} עברה להכנה מיידית.`;
    const trackingUrl = `${appBaseUrl()}/s/${order.tenant.slug}/orders/${order.id}`;

    if (channel === "email") {
      const to =
        order.customerEmailSnap?.trim() || order.customer?.email?.trim() || null;
      if (!to) return;
      const name = order.customerFirstNameSnap?.trim();
      const subject = `עדכון שעת ההזמנה ב-${order.tenant.name} · ${order.number}`;
      const { html, text } = renderRtlEmail({
        subject,
        brand: order.tenant.name,
        preheader: line,
        heading: "עדכון שעת ההזמנה",
        paragraphs: [name ? `היי ${name},` : "היי,", line],
        button: { href: trackingUrl, label: "למעקב אחרי ההזמנה" },
      });
      await sendEmail({
        tenantId: order.tenant.id,
        to,
        subject,
        body: text,
        html,
        fromName: order.tenant.name,
        kind: "order_rescheduled",
        refKind: "order",
        refId: orderId,
      });
      return;
    }

    if (!order.customerPhoneSnap) return;
    await sendViaChannel(
      order.tenant,
      channel,
      order.customerPhoneSnap,
      `${order.tenant.name}: ${line}\n${trackingUrl}`,
      "order_rescheduled",
      orderId,
    );
  } catch (err) {
    console.error("[notify] order rescheduled failed:", err);
  }
}
