import { providerPost } from "@/lib/delivery-providers/http";
import type { DeliveryProviderSettings } from "@/lib/delivery-providers/config";
import type { DeliveryProviderAdapter, ProviderSendResult } from "@/lib/delivery-providers/types";

function baseUrl(settings: DeliveryProviderSettings): string {
  return settings.values.environment === "staging"
    ? "https://staging-sendimanapi.com"
    : "https://sendimanapi.com";
}

function authHeader(settings: DeliveryProviderSettings): Record<string, string> {
  const token = Buffer.from(`${settings.values.apiUsername}:${settings.values.apiPassword}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function rejectBodyError(res: ProviderSendResult & { json: unknown }): ProviderSendResult {
  const { json, ...rest } = res;
  const body = asObj(json);
  if (rest.ok && (body.status === "error" || typeof body.error === "string")) {
    return { ...rest, ok: false, error: String(body.message ?? body.error ?? "sendi_error") };
  }
  return rest;
}

export const sendiAdapter: DeliveryProviderAdapter = {
  async send(order, settings) {
    const body: Record<string, unknown> = {
      rest_username: settings.values.restUsername,
      order_id: order.number,
      client_phone: order.customerPhone,
      client_name: order.customerName,
      delivery_address: order.address,
      client_city: order.city,
      client_street: order.street,
      client_apartment: order.apartment,
      client_entry: order.entrance,
      client_floor: order.floor,
      client_notes: order.remarks,
      order_delay: String(settings.prepMinutes),
    };
    if (order.lat != null && order.lng != null) {
      body.client_latitude = String(order.lat);
      body.client_longitude = String(order.lng);
    }
    if (order.cashToCollect != null) body.sum_cash = order.cashToCollect;
    if (order.tip > 0) body.runner_tip = order.tip;

    const res = await providerPost(`${baseUrl(settings)}/delivery/createDelivery`, authHeader(settings), body);
    const data = asObj(asObj(res.json).data);
    const result = rejectBodyError(res);
    const ref = data.order_id != null ? String(data.order_id) : null;
    return { ...result, ref };
  },

  async cancel(order, settings) {
    if (!order.ref) {
      return { ok: false, status: 0, response: "", error: "missing_sendi_order_id" };
    }
    return rejectBodyError(
      await providerPost(`${baseUrl(settings)}/delivery/cancelDelivery`, authHeader(settings), {
        order_id: order.ref,
      }),
    );
  },

  async ready(order, settings) {
    return rejectBodyError(
      await providerPost(`${baseUrl(settings)}/delivery/updateDeliveryPreparationTime`, authHeader(settings), {
        order_id: order.number,
        cook_time: 0,
        rest_username: settings.values.restUsername,
      }),
    );
  },
};
