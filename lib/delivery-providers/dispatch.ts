import { prisma } from "@/lib/db/client";
import { DELIVERY_PROVIDERS, providerMeta, type DeliveryProviderId } from "@/lib/delivery-providers/catalog";
import { isProviderReady, readProviderSettings } from "@/lib/delivery-providers/config";
import { baliAdapter } from "@/lib/delivery-providers/bali";
import { sendiAdapter } from "@/lib/delivery-providers/sendi";
import type { DeliveryProviderAdapter, ProviderOrder } from "@/lib/delivery-providers/types";

const ADAPTERS: Record<DeliveryProviderId, DeliveryProviderAdapter> = {
  bali: baliAdapter,
  sendi: sendiAdapter,
};

export type DispatchResult =
  | { ok: true; alreadySent: boolean }
  | { ok: false; code: "not_found" | "not_delivery" | "closed" | "not_configured" | "other_provider" | "send_failed"; message: string };

async function logEvent(orderId: string, type: string, payload: Record<string, unknown>) {
  await prisma.orderEvent
    .create({ data: { orderId, type, payload: payload as never } })
    .catch((err) => console.warn("[delivery-provider] event log failed", err));
}

export async function dispatchOrderToProvider(
  orderId: string,
  providerId: DeliveryProviderId,
  source: "manual" | "auto",
): Promise<DispatchResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { deliveryAddress: true, tenant: { select: { deliveryProviders: true } } },
  });
  if (!order) return { ok: false, code: "not_found", message: "הזמנה לא נמצאה" };
  if (order.method !== "delivery") {
    return { ok: false, code: "not_delivery", message: "רק הזמנות משלוח נשלחות לחברת משלוחים" };
  }
  if (order.deliveryProviderDispatchedAt) {
    if (order.deliveryProvider === providerId) return { ok: true, alreadySent: true };
    return {
      ok: false,
      code: "other_provider",
      message: `ההזמנה כבר נשלחה ל${providerMeta(order.deliveryProvider ?? "")?.label ?? "חברת משלוחים אחרת"}`,
    };
  }
  if (["cancelled", "refunded", "delivered"].includes(order.status)) {
    return { ok: false, code: "closed", message: "ההזמנה כבר סגורה" };
  }

  const settings = readProviderSettings(order.tenant.deliveryProviders, providerId);
  if (!isProviderReady(providerId, settings)) {
    return { ok: false, code: "not_configured", message: "חברת המשלוחים לא מוגדרת. עברו למסך השליחים." };
  }

  const addr = order.deliveryAddress;
  const isCashDue = order.paymentMethod === "cash" && order.paymentStatus !== "paid";
  const payload: ProviderOrder = {
    number: order.number,
    customerName: [order.customerFirstNameSnap, order.customerLastNameSnap].filter(Boolean).join(" ").trim(),
    customerPhone: order.customerPhoneSnap ?? "",
    address: [addr?.street, addr?.city].map((s) => s?.trim()).filter(Boolean).join(", "),
    city: addr?.city?.trim() ?? "",
    street: addr?.street?.trim() ?? "",
    entrance: addr?.entrance ?? "",
    apartment: addr?.apartment ?? "",
    floor: addr?.floor ?? "",
    remarks: [addr?.notes, order.deliveryNotes, order.customerNotes]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .join(" · "),
    lat: addr?.lat != null ? Number(addr.lat) : null,
    lng: addr?.lng != null ? Number(addr.lng) : null,
    cashToCollect: isCashDue ? order.total : null,
    tip: order.tip ?? 0,
  };

  const res = await ADAPTERS[providerId].send(payload, settings);

  await logEvent(order.id, res.ok ? "delivery_provider_dispatched" : "delivery_provider_failed", {
    provider: providerId,
    action: "create",
    source,
    ref: res.ref ?? null,
    http_status: res.status,
    error: res.error,
    response: res.response,
  });

  if (!res.ok) {
    console.warn("[delivery-provider] send failed", providerId, order.number, res.status, res.error);
    return {
      ok: false,
      code: "send_failed",
      message: `השליחה ל${providerMeta(providerId)?.label ?? providerId} נכשלה. נסו שוב או שייכו שליח פנימי.`,
    };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { deliveryProvider: providerId, deliveryProviderDispatchedAt: new Date() },
  });
  return { ok: true, alreadySent: false };
}

export async function autoDispatchOnAccept(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { method: true, deliveryProviderDispatchedAt: true, tenant: { select: { deliveryProviders: true } } },
  });
  if (!order || order.method !== "delivery" || order.deliveryProviderDispatchedAt) return;
  const auto = DELIVERY_PROVIDERS.find((p) => {
    const s = readProviderSettings(order.tenant.deliveryProviders, p.id);
    return s.autoDispatch && isProviderReady(p.id, s);
  });
  if (!auto) return;
  await dispatchOrderToProvider(orderId, auto.id, "auto");
}

async function followUp(orderId: string, action: "cancel" | "ready"): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      deliveryProvider: true,
      deliveryProviderDispatchedAt: true,
      tenant: { select: { deliveryProviders: true } },
    },
  });
  if (!order?.deliveryProviderDispatchedAt || !order.deliveryProvider) return;
  const meta = providerMeta(order.deliveryProvider);
  if (!meta) return;
  const adapter = ADAPTERS[meta.id];
  const op = action === "cancel" ? adapter.cancel : adapter.ready;
  if (!op) return;
  const settings = readProviderSettings(order.tenant.deliveryProviders, meta.id);
  if (!meta.fields.every((f) => f.optional || !!settings.values[f.key])) return;

  const dispatched = await prisma.orderEvent.findFirst({
    where: { orderId: order.id, type: "delivery_provider_dispatched" },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  const ref = (dispatched?.payload as Record<string, unknown> | null)?.ref;

  const res = await op({ number: order.number, ref: typeof ref === "string" ? ref : null }, settings);
  if (!res.ok) console.warn("[delivery-provider]", action, "failed", meta.id, order.number, res.status, res.error);
  await logEvent(order.id, res.ok ? `delivery_provider_${action === "cancel" ? "cancelled" : "ready"}` : "delivery_provider_failed", {
    provider: meta.id,
    action,
    http_status: res.status,
    error: res.error,
    response: res.response,
  });
}

export function cancelProviderDelivery(orderId: string): Promise<void> {
  return followUp(orderId, "cancel");
}

export function markProviderReady(orderId: string): Promise<void> {
  return followUp(orderId, "ready");
}
