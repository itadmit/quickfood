/**
 * New-order alerts to the BUSINESS OWNER, complementing the dashboard push.
 * Channels come from Tenant.notifySettings.merchant_new_order:
 *   - email    (default ON)  → owner MerchantUser's email, branded template
 *   - whatsapp (default OFF) → owner's phone via the PLATFORM iBot account
 *                              (QuickFood's own number - no tenant creds, no
 *                              credit charge, same track as the welcome message)
 *
 * Fired from the same two points as the new-order push: storefront cash at
 * creation, card on the payment callback. Best-effort and non-throwing.
 */
import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import { merchantNewOrderEmail, type OrderConfirmedItem } from "@/lib/email/templates";
import { resolveMerchantNewOrderSettings } from "@/lib/messaging/notify-settings";
import {
  parseOptions,
  formatAddress,
  formatScheduledFor,
  appBaseUrl,
} from "@/lib/orders/notify-customer";
import {
  callIBotSendText,
  normalizePhone,
  isValidIsraeliMobile,
  toJid,
} from "@/lib/whatsapp/send";

async function sendOwnerWhatsApp(phone: string, msg: string): Promise<void> {
  const local = normalizePhone(phone);
  if (!isValidIsraeliMobile(local)) return;
  const platform = await prisma.platformSettings.findUnique({
    where: { id: "singleton" },
    select: { whatsappDefaultToken: true, whatsappDefaultInstanceId: true },
  });
  if (!platform?.whatsappDefaultToken || !platform.whatsappDefaultInstanceId) return;
  await callIBotSendText({
    token: platform.whatsappDefaultToken,
    instanceId: platform.whatsappDefaultInstanceId,
    jid: toJid(local),
    msg,
  });
}

export async function notifyMerchantNewOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { menuItem: { select: { images: true, imageUrl: true } } },
      },
      deliveryAddress: true,
      tenant: { select: { id: true, name: true, notifySettings: true } },
    },
  });
  if (!order) return;

  const settings = resolveMerchantNewOrderSettings(order.tenant.notifySettings);
  if (!settings.email && !settings.whatsapp) return;

  const owner = await prisma.merchantUser.findFirst({
    where: { tenantId: order.tenant.id, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { email: true, phone: true },
  });
  if (!owner) return;

  const businessName = order.tenant.name;
  const dashboardUrl = `${appBaseUrl()}/dashboard/orders`;
  const customerName =
    [order.customerFirstNameSnap, order.customerLastNameSnap].filter(Boolean).join(" ").trim() ||
    null;
  const addressLine = order.method === "delivery" ? formatAddress(order.deliveryAddress) : null;

  if (settings.email && owner.email) {
    const items: OrderConfirmedItem[] = order.items.map((it) => ({
      name: it.nameSnapshot,
      size: it.sizeSnapshot,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      totalPrice: it.totalPrice,
      notes: it.notes,
      options: parseOptions(it.selectedOptions),
      imageUrl: it.menuItem?.images?.[0] ?? it.menuItem?.imageUrl ?? null,
    }));
    const { html, text } = merchantNewOrderEmail({
      businessName,
      orderNumber: order.number,
      method: order.method,
      paymentMethod: order.paymentMethod,
      items,
      total: order.total,
      dashboardUrl,
      customerName,
      customerPhone: order.customerPhoneSnap,
      addressLine,
      scheduledForLabel: formatScheduledFor(order.scheduledFor),
      customerNotes: order.customerNotes,
    });
    await sendEmail({
      tenantId: order.tenantId,
      to: owner.email,
      subject: `הזמנה חדשה ב-${businessName} · ${order.number}`,
      body: text,
      html,
      kind: "merchant_new_order",
      refKind: "order",
      refId: order.id,
    }).catch((err) => console.warn("[notify-merchant] email failed", err));
  }

  if (settings.whatsapp && owner.phone) {
    const itemLines = order.items
      .map((it) => `• ${it.quantity}× ${it.nameSnapshot}`)
      .join("\n");
    const methodLabel = order.method === "delivery" ? "משלוח" : "איסוף";
    const msg =
      `*הזמנה חדשה ב-${businessName}* - ${order.number}\n\n` +
      `${itemLines}\n\n` +
      `סה"כ: ₪${order.total} · ${methodLabel}` +
      (customerName ? `\nלקוח: ${customerName}` : "") +
      (order.customerPhoneSnap ? ` · ${order.customerPhoneSnap}` : "") +
      (addressLine ? `\nכתובת: ${addressLine}` : "") +
      (order.customerNotes ? `\nהערה: ${order.customerNotes}` : "") +
      `\n\nלניהול ההזמנות:\n${dashboardUrl}`;
    await sendOwnerWhatsApp(owner.phone, msg).catch((err) =>
      console.warn("[notify-merchant] whatsapp failed", err),
    );
  }
}
