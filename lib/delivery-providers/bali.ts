import { providerPost } from "@/lib/delivery-providers/http";
import type { DeliveryProviderAdapter } from "@/lib/delivery-providers/types";

const ENDPOINT =
  process.env.BALI_CREATE_ORDER_URL ??
  "https://6sald4neod.execute-api.eu-central-1.amazonaws.com/default/bali-create-new-order";

export const baliAdapter: DeliveryProviderAdapter = {
  async send(order, settings) {
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
    const r = await providerPost(ENDPOINT, { "x-api-key": settings.values.apiKey }, body);
    return { ok: r.ok, status: r.status, response: r.response, error: r.error };
  },
};
