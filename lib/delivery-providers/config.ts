import {
  DELIVERY_PROVIDERS,
  providerMeta,
  type DeliveryProviderId,
} from "@/lib/delivery-providers/catalog";

export interface DeliveryProviderSettings {
  enabled: boolean;
  autoDispatch: boolean;
  prepMinutes: number;
  values: Record<string, string>;
}

const DEFAULT_PREP = 15;

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export function readProviderSettings(raw: unknown, id: DeliveryProviderId): DeliveryProviderSettings {
  const meta = providerMeta(id);
  const src = asRecord(asRecord(raw)[id]);
  const values: Record<string, string> = {};
  for (const f of meta?.fields ?? []) {
    const v = src[f.key];
    values[f.key] = typeof v === "string" ? v.trim() : "";
  }
  const prep = Number(src.prepMinutes);
  return {
    enabled: src.enabled === true,
    autoDispatch: src.autoDispatch === true,
    prepMinutes: Number.isFinite(prep) && prep > 0 ? Math.round(prep) : DEFAULT_PREP,
    values,
  };
}

export function isProviderReady(id: DeliveryProviderId, s: DeliveryProviderSettings): boolean {
  const meta = providerMeta(id);
  if (!meta || !s.enabled) return false;
  return meta.fields.every((f) => !!s.values[f.key]);
}

export function activeDeliveryProviders(raw: unknown): Array<{ id: DeliveryProviderId; label: string }> {
  return DELIVERY_PROVIDERS.filter((p) => isProviderReady(p.id, readProviderSettings(raw, p.id))).map(
    (p) => ({ id: p.id, label: p.label }),
  );
}
