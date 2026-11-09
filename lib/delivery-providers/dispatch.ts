import { prisma } from "@/lib/db/client";
import { DELIVERY_PROVIDERS, providerMeta, type DeliveryProviderId } from "@/lib/delivery-providers/catalog";
import { isProviderReady, readProviderSettings, type DeliveryProviderSettings } from "@/lib/delivery-providers/config";
import { sendToBali } from "@/lib/delivery-providers/bali";
import type { ProviderOrder, ProviderSendResult } from "@/lib/delivery-providers/types";

const SENDERS: Record<
  DeliveryProviderId,
  (order: ProviderOrder, settings: DeliveryProviderSettings) => Promise<ProviderSendResult>
> = {
  bali: sendToBali,
};

export type DispatchResult =
  | { ok: true; alreadySent: boolean }
  | { ok: false; code: "not_found" | "not_delivery" | "closed" | "not_configured" | "other_provider" | "send_failed"; message: string };

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
  const payload: ProviderOrder = {
    number: order.number,
    customerName: [order.customerFirstNameSnap, order.customerLastNameSnap].filter(Boolean).join(" ").trim(),
    customerPhone: order.customerPhoneSnap ?? "",
    address: [addr?.street, addr?.city].map((s) => s?.trim()).filter(Boolean).join(", "),
    entrance: addr?.entrance ?? "",
    apartment: addr?.apartment ?? "",
    floor: addr?.floor ?? "",
    remarks: [addr?.notes, order.deliveryNotes, order.customerNotes]
      .filter((s): s is string => !!s && s.trim().length > 0)
      .join(" · "),
    lat: addr?.lat != null ? Number(addr.lat) : null,
    lng: addr?.lng != null ? Number(addr.lng) : null,
  };

  const res = await SENDERS[providerId](payload, settings);

  await prisma.orderEvent
    .create({
      data: {
        orderId: order.id,
        type: res.ok ? "delivery_provider_dispatched" : "delivery_provider_failed",
        payload: {
          provider: providerId,
          source,
          http_status: res.status,
          error: res.error,
          response: res.response,
        },
      },
    })
    .catch((err) => console.warn("[delivery-provider] event log failed", err));

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
