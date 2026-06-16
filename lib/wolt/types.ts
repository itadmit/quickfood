// Shapes for the Wolt Order webhook payload + Order API. Modelled on the
// Order API reference (https://developer.wolt.com/docs/api/order). Field
// paths marked TODO(sandbox) must be verified against a real payload before
// going live - Wolt occasionally nests price/options differently per market.

export interface WoltMoney {
  /** Minor units (agorot for ILS). */
  amount: number;
  currency: string;
}

export interface WoltOrderOption {
  id?: string;
  name?: string;
  value?: string;
  /** Per-option price delta, minor units. */
  price?: WoltMoney;
  count?: number;
}

export interface WoltOrderItem {
  /** Wolt's catalogue item id - matches MenuItem.externalId for imported items. */
  id?: string;
  sku?: string;
  name: string;
  count: number;
  /** Unit (or line) price, minor units. TODO(sandbox): confirm unit vs line. */
  price?: WoltMoney;
  total_price?: WoltMoney;
  options?: WoltOrderOption[];
}

export type WoltDeliveryType = "homedelivery" | "takeaway" | "eatin";

export interface WoltOrderPayload {
  /** Wolt order id - the idempotency key for our webhook. */
  id: string;
  order_number?: string;
  order_status?: string;
  venue_id?: string;
  type?: WoltDeliveryType;
  consumer_name?: string;
  consumer_phone_number?: string;
  consumer_comment?: string;
  pickup_eta?: string;
  price?: WoltMoney;
  delivery?: {
    type?: WoltDeliveryType;
    fee?: WoltMoney;
    location?: { street?: string; city?: string; formatted_address?: string };
  };
  items: WoltOrderItem[];
  created_at?: string;
  modified_at?: string;
}

export interface WoltTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
