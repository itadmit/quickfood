import { prisma } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";
import {
  orderConfirmedEmail,
  orderCancelledEmail,
  type OrderConfirmedItem,
} from "@/lib/email/templates";

interface OptionShape {
  name?: string;
  price_delta?: number;
}

function parseOptions(raw: unknown): Array<{ name: string; priceDelta: number }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o) => {
      const opt = o as OptionShape;
      if (!opt || typeof opt.name !== "string") return null;
      return { name: opt.name, priceDelta: Number(opt.price_delta ?? 0) || 0 };
    })
    .filter((o): o is { name: string; priceDelta: number } => o !== null);
}

function formatAddress(addr: {
  street?: string | null;
  city?: string | null;
  apartment?: string | null;
  floor?: string | null;
  entrance?: string | null;
} | null): string | null {
  if (!addr) return null;
  const base = [addr.street, addr.city].filter(Boolean).join(", ");
  if (!base) return null;
  const extras: string[] = [];
  if (addr.apartment) extras.push(`דירה ${addr.apartment}`);
  if (addr.floor) extras.push(`קומה ${addr.floor}`);
  if (addr.entrance) extras.push(`כניסה ${addr.entrance}`);
  return extras.length ? `${base} (${extras.join(", ")})` : base;
}

function formatScheduledFor(d: Date | null): string | null {
  if (!d) return null;
  try {
    return new Intl.DateTimeFormat("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://quickfood.co.il").replace(/\/$/, "");
}

function normalizeIsraeliPhoneForWa(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!/^05\d{8}$/.test(digits)) return null;
  return `972${digits.slice(1)}`;
}

export async function sendOrderConfirmedEmail(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { menuItem: { select: { images: true, imageUrl: true } } },
      },
      tenant: { select: { name: true, slug: true } },
      branch: { select: { phone: true } },
      deliveryAddress: true,
      customer: { select: { email: true } },
    },
  });
  if (!order) return;

  const to = order.customerEmailSnap?.trim() || order.customer?.email?.trim() || null;
  if (!to) return;

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

  const customerName =
    order.customerFirstNameSnap?.trim() ||
    [order.customerFirstNameSnap, order.customerLastNameSnap].filter(Boolean).join(" ").trim() ||
    "לקוח";
  const businessName = order.tenant.name ?? "QuickFood";
  const trackingUrl = `${appBaseUrl()}/s/${order.tenant.slug}/orders/${order.id}`;
  const addressLine = order.method === "delivery" ? formatAddress(order.deliveryAddress) : null;
  const branchPhone = order.branch?.phone ?? null;
  const waNumber = normalizeIsraeliPhoneForWa(branchPhone);
  const whatsappLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`שלום, יש לי שאלה לגבי הזמנה ${order.number}`)}`
    : null;

  const { html, text, subject } = ((): { html: string; text: string; subject: string } => {
    const rendered = orderConfirmedEmail({
      customerName,
      businessName,
      orderNumber: order.number,
      method: order.method,
      paymentMethod: order.paymentMethod,
      items,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      serviceFee: order.serviceFee,
      cutleryFee: order.cutleryFee,
      tip: order.tip,
      discount: order.discount,
      total: order.total,
      trackingUrl,
      addressLine,
      branchPhone,
      whatsappLink,
      scheduledForLabel: formatScheduledFor(order.scheduledFor),
      customerNotes: order.customerNotes,
    });
    return {
      html: rendered.html,
      text: rendered.text,
      subject: `תודה על ההזמנה ב-${businessName} · ${order.number}`,
    };
  })();

  await sendEmail({
    tenantId: order.tenantId,
    to,
    subject,
    body: text,
    html,
    fromName: businessName,
    kind: "order_confirmed",
    refKind: "order",
    refId: order.id,
  });
}

export async function sendOrderCancelledEmail(
  orderId: string,
  options?: { reason?: string | null },
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      tenant: { select: { name: true } },
      branch: { select: { phone: true } },
      customer: { select: { email: true } },
    },
  });
  if (!order) return;

  const to = order.customerEmailSnap?.trim() || order.customer?.email?.trim() || null;
  if (!to) return;

  const customerName =
    order.customerFirstNameSnap?.trim() ||
    [order.customerFirstNameSnap, order.customerLastNameSnap].filter(Boolean).join(" ").trim() ||
    "לקוח";
  const businessName = order.tenant.name ?? "QuickFood";
  const branchPhone = order.branch?.phone ?? null;
  const waNumber = normalizeIsraeliPhoneForWa(branchPhone);
  const whatsappLink = waNumber
    ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`שלום, ההזמנה שלי ${order.number} בוטלה`)}`
    : null;

  const { html, text } = orderCancelledEmail({
    customerName,
    businessName,
    orderNumber: order.number,
    total: order.total,
    paymentMethod: order.paymentMethod,
    reason: options?.reason ?? null,
    branchPhone,
    whatsappLink,
  });

  await sendEmail({
    tenantId: order.tenantId,
    to,
    subject: `הזמנה ${order.number} בוטלה · ${businessName}`,
    body: text,
    html,
    fromName: businessName,
    kind: "order_cancelled",
    refKind: "order",
    refId: order.id,
  });
}
