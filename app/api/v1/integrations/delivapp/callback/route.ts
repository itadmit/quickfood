/**
 * POST /api/v1/integrations/delivapp/callback?token=<inboundToken>
 *
 * Inbound courier-status webhook from DelivApp. Their docs expose no signature
 * scheme, so we authenticate on the unguessable per-tenant `inboundToken` we
 * minted (stored in Tenant.delivAppConfig.inboundToken and configured in the
 * merchant's DelivApp webhook URL).
 *
 * Body (per DelivApp): { order_id, delivery_status: 1..8, data?: { driver_name, phone } }
 * `order_id` is the value we sent as `OrderID` on create - i.e. our Order.number.
 *
 * We always record the numeric status on Order.delivAppStatus, and advance the
 * local order lifecycle only when the code maps to a legal transition (guarded
 * by the state machine). Unknown / out-of-order codes never throw a 500 back at
 * DelivApp - we ack with 200 so they stop retrying.
 */
import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { advanceStatus, canTransition } from "@/lib/orders";
import { resolveDelivAppConfig } from "@/lib/delivapp/config";
import { mapDelivAppStatus, DELIVAPP_STATUS_LABEL } from "@/lib/delivapp/map-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return apiError("missing_token", "missing ?token", 401);

  const body = (await req.json().catch(() => ({}))) as {
    order_id?: string;
    delivery_status?: number;
  };

  const orderNumber = body.order_id?.toString().trim();
  const code = Number(body.delivery_status);
  if (!orderNumber || !Number.isFinite(code)) {
    return apiError("bad_payload", "order_id and delivery_status required", 400);
  }

  // Resolve the order by its human number, then verify the inbound token
  // matches THAT order's tenant config. This both authenticates the caller and
  // scopes them to a single tenant (a leaked token can only touch its own store).
  const order = await prisma.order.findFirst({
    where: { number: orderNumber, delivAppBarcodeId: { not: null } },
    select: { id: true, status: true, tenantId: true },
  });
  if (!order) return apiError("order_not_found", "unknown order", 404);

  const tenant = await prisma.tenant.findUnique({
    where: { id: order.tenantId },
    select: { delivAppConfig: true },
  });
  const cfg = resolveDelivAppConfig(tenant?.delivAppConfig);
  if (!cfg || !cfg.inboundToken || cfg.inboundToken !== token) {
    return apiError("unauthorized", "bad token", 401);
  }

  // DelivApp's docs expose no HMAC, but they echo the integration's
  // X-Parse-Application-Id on the webhook. Belt-and-suspenders: when that
  // header is present it MUST match this tenant's appId; absent, the token
  // alone authenticates.
  const appIdHeader = req.headers.get("x-parse-application-id");
  if (appIdHeader && appIdHeader !== cfg.appId) {
    return apiError("unauthorized", "app id mismatch", 401);
  }

  // Record the raw courier status for dashboard visibility regardless of
  // whether it drives a local lifecycle change.
  await prisma.order
    .update({ where: { id: order.id }, data: { delivAppStatus: code } })
    .catch((err) => console.warn("[delivapp] store status failed", err));

  const target = mapDelivAppStatus(code);
  if (target && target !== order.status && canTransition(order.status, target)) {
    await advanceStatus(order.id, target, {
      reason: `DelivApp: ${DELIVAPP_STATUS_LABEL[code] ?? code}`,
      changedBy: "delivapp",
    }).catch((err) => console.warn("[delivapp] advanceStatus failed", err));
  }

  return apiJson({ ok: true });
});
