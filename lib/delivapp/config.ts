/**
 * DelivApp per-tenant integration config. Stored as JSON on
 * `Tenant.delivAppConfig` (see prisma/schema.prisma) and set by the merchant
 * from the dashboard settings page. The integration is fully opt-in: unless
 * `enabled` is true AND the three DelivApp credentials are present, every
 * dispatch helper is a silent no-op so tenants who never touch it are
 * unaffected.
 *
 * `apiKey` and `inboundToken` are SECRETS - never log them, never send them to
 * the customer storefront. Only the merchant dashboard (server side) reads them.
 */

export interface DelivAppConfig {
  /** Master switch. False = the whole integration is off for this tenant. */
  enabled: boolean;
  /** DelivApp business entity id - their `RestID`. */
  restId: string;
  /** DelivApp integration id - sent as the `X-Parse-Application-Id` header. */
  appId: string;
  /** DelivApp REST API key - sent as the `X-Parse-REST-API-Key` header. Secret. */
  apiKey: string;
  /**
   * Shared secret we mint for this tenant. DelivApp includes it in the inbound
   * status-webhook URL (`?token=...`) so we can authenticate callbacks without
   * an HMAC scheme (their docs expose none). Secret.
   */
  inboundToken: string;
}

/**
 * Parse + validate the raw `Tenant.delivAppConfig` JSON. Returns a fully
 * populated config only when the integration is enabled and every required
 * credential is present; otherwise null (caller treats null as "off").
 */
export function resolveDelivAppConfig(raw: unknown): DelivAppConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (c.enabled !== true) return null;

  const restId = typeof c.restId === "string" ? c.restId.trim() : "";
  const appId = typeof c.appId === "string" ? c.appId.trim() : "";
  const apiKey = typeof c.apiKey === "string" ? c.apiKey.trim() : "";
  const inboundToken =
    typeof c.inboundToken === "string" ? c.inboundToken.trim() : "";

  if (!restId || !appId || !apiKey) return null;

  return { enabled: true, restId, appId, apiKey, inboundToken };
}
