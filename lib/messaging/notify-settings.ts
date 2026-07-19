/**
 * Per-event transactional notification settings.
 *
 * Stored on `Tenant.notifySettings` (JSON). Each order event (confirmed /
 * ready / on_the_way / delivered) gets its own { enabled, channel }. The
 * review reminder keeps its own dedicated columns (reviewsChannel /
 * reviewsDelayMinutes) and is NOT part of this object.
 *
 * resolveOrderNotifySettings merges the stored JSON over a default derived
 * from the legacy single `notifyChannel` column, so tenants that never opened
 * the new screen keep their exact previous behaviour (the same channel on all
 * four events; `email`/`off` = no paid send beyond the always-on email).
 */

export type NotifyChannel = "off" | "email" | "sms" | "whatsapp" | "whatsapp_managed";

export type OrderNotifyEvent = "confirmed" | "ready" | "on_the_way" | "delivered";

export const ORDER_NOTIFY_EVENTS: OrderNotifyEvent[] = [
  "confirmed",
  "ready",
  "on_the_way",
  "delivered",
];

export interface OrderEventConfig {
  enabled: boolean;
  channel: NotifyChannel;
  /**
   * Optional merchant override for the message body. When null/blank the
   * channel-aware built-in default is used. May contain `{business}`,
   * `{order}`, `{courier}`, `{courier_phone}`, `{waze}` tokens.
   */
  text?: string | null;
}

export type OrderNotifySettings = Record<OrderNotifyEvent, OrderEventConfig>;

const CHANNELS: NotifyChannel[] = ["off", "email", "sms", "whatsapp", "whatsapp_managed"];

function asChannel(v: unknown, fallback: NotifyChannel): NotifyChannel {
  return typeof v === "string" && (CHANNELS as string[]).includes(v)
    ? (v as NotifyChannel)
    : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asText(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

/**
 * Default per-event config for a tenant that never opened the messaging screen.
 *
 * If the tenant had explicitly picked a PAID legacy `notifyChannel`, preserve
 * the old behaviour (that channel fires on every event). Otherwise apply the
 * free-email default (product decision 2026-07-19): notify the customer by
 * email on order-confirmed, ready, and on-the-way. `delivered` stays off by
 * default (the review reminder already lands after delivery). Email is free
 * via Resend, so this ships to every active store with no per-message cost.
 */
function defaultFromLegacy(legacy: NotifyChannel): OrderNotifySettings {
  const isPaid = legacy === "sms" || legacy === "whatsapp" || legacy === "whatsapp_managed";
  if (isPaid) {
    const base: OrderEventConfig = { enabled: true, channel: legacy, text: null };
    return {
      confirmed: { ...base },
      ready: { ...base },
      on_the_way: { ...base },
      delivered: { ...base },
    };
  }
  const email = (enabled: boolean): OrderEventConfig => ({
    enabled,
    channel: "email",
    text: null,
  });
  return {
    confirmed: email(true),
    ready: email(true),
    on_the_way: email(true),
    delivered: email(false),
  };
}

/**
 * How the BUSINESS OWNER hears about a new order, on top of the always-on
 * dashboard push. Stored under `merchant_new_order` in the same
 * Tenant.notifySettings JSON. Email defaults ON so a fresh tenant gets
 * order emails with zero setup; WhatsApp goes out from the platform's own
 * iBot number, so it needs no tenant credentials or credits.
 */
export interface MerchantNewOrderSettings {
  email: boolean;
  whatsapp: boolean;
}

export function resolveMerchantNewOrderSettings(raw: unknown): MerchantNewOrderSettings {
  const src =
    raw && typeof raw === "object"
      ? ((raw as Record<string, unknown>).merchant_new_order as Record<string, unknown> | undefined)
      : undefined;
  return {
    email: asBool(src?.email, true),
    whatsapp: asBool(src?.whatsapp, false),
  };
}

export function resolveOrderNotifySettings(
  raw: unknown,
  legacyNotifyChannel: NotifyChannel,
): OrderNotifySettings {
  const d = defaultFromLegacy(legacyNotifyChannel);
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const out = {} as OrderNotifySettings;
  for (const ev of ORDER_NOTIFY_EVENTS) {
    const e = (r[ev] ?? {}) as Record<string, unknown>;
    out[ev] = {
      enabled: asBool(e.enabled, d[ev].enabled),
      channel: asChannel(e.channel, d[ev].channel),
      text: asText(e.text),
    };
  }
  return out;
}
