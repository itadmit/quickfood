import type { DeliveryProviderSettings } from "@/lib/delivery-providers/config";
import type { ProviderOrder, ProviderSendResult } from "@/lib/delivery-providers/types";

const ENDPOINT =
  process.env.BALI_CREATE_ORDER_URL ??
  "https://6sald4neod.execute-api.eu-central-1.amazonaws.com/default/bali-create-new-order";
const TIMEOUT_MS = 8000;

export async function sendToBali(
  order: ProviderOrder,
  settings: DeliveryProviderSettings,
): Promise<ProviderSendResult> {
  const body: Record<string, unknown> = {
    shopID: settings.values.shopId,
    orderID: order.number,
    name: order.customerName,
    phone: order.customerPhone,
    address: order.address,
    entrance: order.entrance,
    flatNumber: order.apartment,
    floor: order.floor,
    remarks: order.remarks,
    prepTime: settings.prepMinutes,
  };
  if (order.lat != null && order.lng != null) {
    body.latitude = order.lat;
    body.longitude = order.lng;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": settings.values.apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = (await res.text().catch(() => "")).slice(0, 500);
    return {
      ok: res.ok,
      status: res.status,
      response: text,
      error: res.ok ? null : `http_${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      response: "",
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
