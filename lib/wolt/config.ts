// Wolt Marketplace integration config. All secrets come from env; the host
// switches between Wolt's dev (sandbox) and production environments via
// WOLT_ENV. Token host is documented at
// https://developer.wolt.com/docs/authentication20 ; the POS/order API host
// must be confirmed against the sandbox once Wolt issues credentials.

type WoltEnv = "dev" | "prod";

const ENV = (process.env.WOLT_ENV === "prod" ? "prod" : "dev") as WoltEnv;

const TOKEN_HOST: Record<WoltEnv, string> = {
  dev: "https://integrations-authentication-service.development.dev.woltapi.com",
  prod: "https://integrations-authentication-service.wolt.com",
};

// POS / Marketplace order API host (accept/reject/ready, order fetch).
// TODO(sandbox): confirm exact host from the Order API reference once we
// have credentials; override with WOLT_API_BASE if it differs.
const API_HOST: Record<WoltEnv, string> = {
  dev: "https://pos-integration-service.development.dev.woltapi.com",
  prod: "https://pos-integration-service.wolt.com",
};

export const woltConfig = {
  env: ENV,
  tokenUrl: `${TOKEN_HOST[ENV]}/oauth2/token`,
  apiBase: process.env.WOLT_API_BASE ?? API_HOST[ENV],
  clientId: process.env.WOLT_CLIENT_ID ?? "",
  clientSecret: process.env.WOLT_CLIENT_SECRET ?? "",
  // Secret submitted in the integration form; Wolt signs the order webhook
  // body with HMAC-SHA256 using it.
  webhookSecret: process.env.WOLT_WEBHOOK_SECRET ?? "",
  // Where Wolt redirects the merchant after SSIO consent.
  redirectUri:
    process.env.WOLT_REDIRECT_URI ??
    "https://quickfood.co.il/api/v1/integrations/wolt/oauth/callback",
};

export function assertWoltConfigured(): void {
  if (!woltConfig.clientId || !woltConfig.clientSecret) {
    throw new Error("Wolt integration not configured (missing WOLT_CLIENT_ID / WOLT_CLIENT_SECRET)");
  }
}
