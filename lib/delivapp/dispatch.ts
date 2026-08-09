/**
 * Outbound DelivApp dispatch. Called (fire-and-forget, via next/server `after`)
 * from the order lifecycle in lib/orders.ts:
 *   - pushOrderToDelivApp: when a DELIVERY order is accepted (leaves pending).
 *   - markOrderReady:      when the order is marked ready.
 *   - cancelOrderDelivApp: when the order is cancelled.
 *
 * Every helper resolves the tenant's config first and no-ops when the
 * integration is disabled / not configured, so it is always safe to call. The
 * QuickFood dashboard flow is never blocked or failed by a DelivApp error - we
 * log and move on.
 */
import { prisma } from "@/lib/db/client";
import { resolveDelivAppConfig } from "@/lib/delivapp/config";
import { delivAppPost } from "@/lib/delivapp/client";

async function loadTenantConfig(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { delivAppConfig: true },
  });
  return resolveDelivAppConfig(tenant?.delivAppConfig);
}

/**
 * Create the order in DelivApp and store the returned BarcodeId on the order.
 * Idempotent: if `delivAppBarcodeId` is already set we skip (a re-accept or a
 * retried `after` won't create a duplicate delivery). Only delivery orders are
 * dispatched - pickup never goes to a courier service.
 */
export async function pushOrderToDelivApp(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, deliveryAddress: true },
  });
  if (!order) return;
  if (order.method !== "delivery") return;
  if (order.delivAppBarcodeId) return; // already dispatched

  const cfg = await loadTenantConfig(order.tenantId);
  if (!cfg) return;

  const addr = order.deliveryAddress;
  const name = [order.customerFirstNameSnap, order.customerLastNameSnap]
    .filter(Boolean)
    .join(" ")
    .trim();

  const notes = [addr?.notes, order.deliveryNotes]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join(" · ");

  const isCash = order.paymentMethod === "cash";
  const isPaid = order.paymentStatus === "paid";

  const body: Record<string, unknown> = {
    RestID: cfg.restId,
    OrderID: order.number,
    CostName: name || undefined,
    CostPhone: order.customerPhoneSnap ?? undefined,
    CostAddCity: addr?.city ?? undefined,
    CostAddStreet: addr?.street ?? undefined,
    CostAddApartment: addr?.apartment ?? undefined,
    CostAddFloor: addr?.floor ?? undefined,
    CostAddBuilding: addr?.entrance ?? undefined,
    CostAddNotes: notes || undefined,
    // DelivApp's docs send money as decimal strings in whole shekels (e.g.
    // "181", "29.90") - NOT agorot. QuickFood already stores order money as
    // integer shekels, so stringify as-is with no unit conversion.
    OrderPrice: String(order.subtotal),
    DeliveryPrice: String(order.deliveryFee),
    OrderTotalCash: isCash ? String(order.total) : undefined,
    IsCashPaid: isCash,
    IsCardPaid: !isCash && isPaid,
    DriverTip: order.tip ? String(order.tip) : undefined,
    OrderRemark: order.customerNotes ?? undefined,
    OrderContent: order.items.map((it) => ({
      Quantity: it.quantity,
      Item: it.nameSnapshot,
      Price: String(it.unitPrice),
    })),
  };

  if (addr?.lat != null && addr?.lng != null) {
    body.VerifiedLocation = {
      Latitude: Number(addr.lat),
      Longitude: Number(addr.lng),
    };
  }

  const res = await delivAppPost({
    path: "/delivery",
    appId: cfg.appId,
    apiKey: cfg.apiKey,
    body,
  });

  if (!res.ok) {
    console.warn("[delivapp] create failed", order.number, res.status, res.error);
    return;
  }

  const barcodeId =
    typeof res.data.BarcodeId === "string"
      ? res.data.BarcodeId
      : res.data.BarcodeId != null
        ? String(res.data.BarcodeId)
        : null;

  if (barcodeId) {
    await prisma.order
      .update({
        where: { id: order.id },
        data: { delivAppBarcodeId: barcodeId },
      })
      .catch((err) => console.warn("[delivapp] store barcode failed", err));
  }
}

/** Tell DelivApp the order is ready for pickup by the courier. */
export async function markOrderReadyDelivApp(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { number: true, tenantId: true, delivAppBarcodeId: true },
  });
  if (!order?.delivAppBarcodeId) return;

  const cfg = await loadTenantConfig(order.tenantId);
  if (!cfg) return;

  const res = await delivAppPost({
    path: "/delivery/ready",
    appId: cfg.appId,
    apiKey: cfg.apiKey,
    body: { RestID: cfg.restId, OrderID: order.number },
  });
  if (!res.ok) {
    console.warn("[delivapp] ready failed", order.number, res.status, res.error);
  }
}

/** Cancel a previously-dispatched DelivApp delivery. */
export async function cancelOrderDelivApp(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { number: true, tenantId: true, delivAppBarcodeId: true },
  });
  if (!order?.delivAppBarcodeId) return;

  const cfg = await loadTenantConfig(order.tenantId);
  if (!cfg) return;

  const res = await delivAppPost({
    path: "/delivery/delete",
    appId: cfg.appId,
    apiKey: cfg.apiKey,
    body: { RestID: cfg.restId, OrderID: order.number },
  });
  if (!res.ok) {
    console.warn("[delivapp] cancel failed", order.number, res.status, res.error);
  }
}
