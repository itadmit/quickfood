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

/**
 * Default per-event config derived from the legacy `notifyChannel`. The old
 * behaviour: a single channel fired on every event, and `email`/`off` meant
 * "no extra send" (the order email is handled separately). So a paid channel
 * → all events on with that channel; `email`/`off` → all events off.
 */
function defaultFromLegacy(legacy: NotifyChannel): OrderNotifySettings {
  const isPaid = legacy === "sms" || legacy === "whatsapp" || legacy === "whatsapp_managed";
  const base: OrderEventConfig = {
    enabled: isPaid,
    channel: isPaid ? legacy : "email",
  };
  return {
    confirmed: { ...base },
    ready: { ...base },
    on_the_way: { ...base },
    delivered: { ...base },
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
    };
  }
  return out;
}
