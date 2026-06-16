import { woltConfig } from "./config";
import { getValidAccessToken } from "./oauth";

// Order status callbacks to Wolt. Endpoints per the Order API reference:
//   PUT /orders/{id}/accept   - accept (optionally with an adjusted prep time)
//   PUT /orders/{id}/reject   - reject (with a reason)
//   PUT /orders/{id}/ready    - mark ready for pickup
// https://developer.wolt.com/docs/api/order

async function putOrder(
  tenantId: string,
  woltOrderId: string,
  action: "accept" | "reject" | "ready",
  body?: Record<string, unknown>,
): Promise<void> {
  const { accessToken } = await getValidAccessToken(tenantId);
  const res = await fetch(`${woltConfig.apiBase}/orders/${encodeURIComponent(woltOrderId)}/${action}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Wolt ${action} failed for order ${woltOrderId} (${res.status}): ${text}`);
  }
}

export function acceptWoltOrder(tenantId: string, woltOrderId: string, prepMinutes?: number): Promise<void> {
  return putOrder(tenantId, woltOrderId, "accept", prepMinutes != null ? { adjusted_pickup_time: prepMinutes } : undefined);
}

export function rejectWoltOrder(tenantId: string, woltOrderId: string, reason: string): Promise<void> {
  return putOrder(tenantId, woltOrderId, "reject", { reason });
}

export function markWoltOrderReady(tenantId: string, woltOrderId: string): Promise<void> {
  return putOrder(tenantId, woltOrderId, "ready");
}
