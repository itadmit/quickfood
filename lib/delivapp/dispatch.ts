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
 * Every dispatch attempt leaves a durable OrderEvent, success or failure. A
 * console.warn evaporates with the lambda, which left the merchant with no way
 * to tell "DelivApp never got this" from "DelivApp got it and lost it".
 */
async function recordDispatchEvent(
  orderId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await prisma.orderEvent
    .create({ data: { orderId, type, payload: payload as never } })
    .catch((err) => console.warn("[delivapp] event log failed", err));
}

/**
 * DelivApp's create response is undocumented beyond the happy path and has been
 * observed without a top-level `BarcodeId`. Accept the common casings and one
 * level of the usual envelope keys rather than silently dropping the id.
 */
function extractBarcodeId(data: Record<string, unknown>, depth = 0): string | null {
  for (const key of ["BarcodeId", "BarcodeID", "barcodeId", "barcode_id", "Barcode"]) {
    const v = data[key];
    if (v != null && v !== "") return String(v);
  }
  if (depth >= 2) return null;
  for (const key of ["result", "Result", "data", "Data", "response", "Response"]) {
    const nested = data[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const found = extractBarcodeId(nested as Record<string, unknown>, depth + 1);
      if (found) return found;
    }
  }
  return null;
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
  if (order.delivAppDispatchedAt) return; // already dispatched

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
    await recordDispatchEvent(order.id, "delivapp_failed", {
      action: "create",
      http_status: res.status,
      error: res.error ?? null,
      response: res.data,
    });
    return;
  }

  const barcodeId = extractBarcodeId(res.data);

  // Mark the order dispatched even when no id came back: the inbound status
  // webhook and the dashboard both key off "did this reach DelivApp", and a
  // missing id used to make a successful dispatch indistinguishable from none.
  await prisma.order
    .update({
      where: { id: order.id },
      data: { delivAppDispatchedAt: new Date(), delivAppBarcodeId: barcodeId },
    })
    .catch((err) => console.warn("[delivapp] store barcode failed", err));

  await recordDispatchEvent(order.id, "delivapp_dispatched", {
    action: "create",
    barcode_id: barcodeId,
    http_status: res.status,
    response: res.data,
  });
}

/** Tell DelivApp the order is ready for pickup by the courier. */
export async function markOrderReadyDelivApp(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, tenantId: true, delivAppDispatchedAt: true },
  });
  if (!order?.delivAppDispatchedAt) return;

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
  await recordDispatchEvent(order.id, res.ok ? "delivapp_ready" : "delivapp_failed", {
    action: "ready",
    http_status: res.status,
    error: res.error ?? null,
    response: res.data,
  });
}

/** Cancel a previously-dispatched DelivApp delivery. */
export async function cancelOrderDelivApp(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, number: true, tenantId: true, delivAppDispatchedAt: true },
  });
  if (!order?.delivAppDispatchedAt) return;

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
  await recordDispatchEvent(order.id, res.ok ? "delivapp_cancelled" : "delivapp_failed", {
    action: "cancel",
    http_status: res.status,
    error: res.error ?? null,
    response: res.data,
  });
}
