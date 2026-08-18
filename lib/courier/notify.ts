import { prisma } from "@/lib/db/client";
import { sendWhatsApp } from "@/lib/whatsapp/send";
import { sendSms } from "@/lib/sms/send";
import { sendCourierPush } from "@/lib/courier/push";
import { sendEmail } from "@/lib/email/send";
import { courierAssignedEmail } from "@/lib/email/templates";

function formatAddress(addr: {
  street?: string | null;
  city?: string | null;
  apartment?: string | null;
  floor?: string | null;
  entrance?: string | null;
} | null): string {
  if (!addr) return "";
  const parts: string[] = [];
  if (addr.street) parts.push(addr.street);
  if (addr.city) parts.push(addr.city);
  const extras: string[] = [];
  if (addr.apartment) extras.push(`דירה ${addr.apartment}`);
  if (addr.floor) extras.push(`קומה ${addr.floor}`);
  if (addr.entrance) extras.push(`כניסה ${addr.entrance}`);
  const main = parts.join(", ");
  return extras.length ? `${main} (${extras.join(", ")})` : main;
}

export async function notifyCourierAssigned(orderId: string, courierId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      deliveryAddress: true,
      tenant: { select: { name: true } },
    },
  });
  if (!order) return;
  const courier = await prisma.courier.findUnique({
    where: { id: courierId },
    select: { phone: true, tenantId: true, name: true, email: true },
  });
  if (!courier) return;

  const addressLine = formatAddress(order.deliveryAddress);
  const customerName =
    order.customerFirstNameSnap || order.customerLastNameSnap
      ? `${order.customerFirstNameSnap ?? ""} ${order.customerLastNameSnap ?? ""}`.trim()
      : "לקוח";
  const lines = [
    `הזמנה חדשה שויכה אליך - ${order.number}`,
    `לקוח: ${customerName}`,
    order.customerPhoneSnap ? `טלפון: ${order.customerPhoneSnap}` : null,
    addressLine ? `כתובת: ${addressLine}` : null,
    `סכום: ${order.total} ש"ח`,
    order.paymentMethod === "cash" ? "תשלום במזומן ביד" : "שולם מראש",
    order.customerNotes ? `הערות: ${order.customerNotes}` : null,
  ].filter(Boolean);
  const body = lines.join("\n");

  void sendCourierPush(courierId, {
    title: `הזמנה ${order.number} שויכה אליך`,
    body: addressLine ? `${customerName} · ${addressLine}` : customerName,
    url: `/courier/orders/${orderId}`,
    tag: `order-${orderId}`,
    requireInteraction: true,
  }).catch((err) => console.warn("[push] courier assigned failed", err));

  // Email (in addition to push + WhatsApp/SMS) when the courier has one on file.
  if (courier.email) {
    const { html, text } = courierAssignedEmail({
      courierName: courier.name,
      businessName: order.tenant?.name ?? "המסעדה",
      orderNumber: order.number,
      detailLines: lines.slice(1) as string[],
      orderUrl: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/courier/orders/${orderId}`
        : undefined,
    });
    void sendEmail({
      tenantId: courier.tenantId,
      to: courier.email,
      subject: `הזמנה ${order.number} שויכה אליך`,
      body: text,
      html,
      kind: "courier_assigned",
      refKind: "order",
      refId: orderId,
    }).catch((err) => console.warn("[email] courier assigned failed", err));
  }

  const wa = await sendWhatsApp({
    tenantId: courier.tenantId,
    to: courier.phone,
    body,
    kind: "courier_assigned",
    refKind: "order",
    refId: orderId,
  });
  if (wa.status === "sent") return;
  if (wa.status === "skipped_no_balance" || wa.status === "invalid_recipient") return;

  await sendSms({
    tenantId: courier.tenantId,
    to: courier.phone,
    body,
    kind: "courier_assigned",
    refKind: "order",
    refId: orderId,
  });
}

