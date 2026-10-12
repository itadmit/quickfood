/**
 * POST /api/payments/callback
 *
 * Server-to-server callback from payment providers. Routed by ?provider=<type>
 * query param. Grow and CardCom land here; Hyp has no S2S webhook at all and
 * is finalized from its browser return URL instead (/api/payments/hyp/return).
 *
 * For Grow:
 *   - Body is application/x-www-form-urlencoded (not JSON)
 *   - No HMAC signature; security relies on IP whitelist + unguessable URL
 *   - We MUST POST /approveTransaction back to Grow, or Grow will retry up to
 *     6 times. This is fired non-blocking after we finalize.
 *
 * Idempotent: re-processing the same callback after the Order is already paid
 * is a no-op (so Grow's retries are safe). The finalization itself lives in
 * lib/payments/finalize-callback.ts, shared with the Hyp return route.
 */

import { apiError, apiJson, handler } from "@/lib/api-response";
import { prisma } from "@/lib/db/client";
import { getConfiguredProvider } from "@/lib/payments/factory";
import { finalizeProviderCallback } from "@/lib/payments/finalize-callback";
import { PaymentProvider } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractHeaders(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  req.headers.forEach((v, k) => (out[k.toLowerCase()] = v));
  return out;
}

async function parseRequestBody(req: Request): Promise<unknown> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return req.json();
  }
  const text = await req.text();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const parsed = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    parsed.forEach((v, k) => (obj[k] = v));
    return obj;
  }
  // Best-effort: try JSON then fall back to urlencoded
  try {
    return JSON.parse(text);
  } catch {
    const parsed = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    parsed.forEach((v, k) => (obj[k] = v));
    return obj;
  }
}

export const POST = handler(async (req: Request) => {
  const url = new URL(req.url);
  const providerParam = url.searchParams.get("provider");
  const tenantSlug = url.searchParams.get("tenant");

  // Entry log: confirms whether Grow actually reaches our domain at all
  // (diagnosing the "0/26 callbacks ever landed" issue). Every hit lands
  // here regardless of validation outcome.
  console.log("[payments/callback] HIT", {
    provider: providerParam,
    tenant: tenantSlug,
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
    ua: req.headers.get("user-agent") ?? null,
  });

  if (!providerParam) return apiError("missing_provider", "missing ?provider", 400);
  if (!tenantSlug) return apiError("missing_tenant", "missing ?tenant", 400);

  const providerType = providerParam as PaymentProvider;
  const SUPPORTED_PROVIDERS: PaymentProvider[] = [
    PaymentProvider.grow,
    PaymentProvider.cardcom,
  ];
  if (!SUPPORTED_PROVIDERS.includes(providerType)) {
    return apiError("unknown_provider", `provider not supported: ${providerParam}`, 400);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true },
  });
  if (!tenant) return apiError("tenant_not_found", "unknown tenant", 404);

  const provider = await getConfiguredProvider(tenant.id, providerType);
  if (!provider) return apiError("provider_unavailable", "provider not configured", 503);

  const headers = extractHeaders(req);
  const body = await parseRequestBody(req);

  const validation = provider.validateWebhook(body, headers);
  if (!validation.isValid) {
    console.warn("[payments/callback] validation failed", validation.error);
    return apiError("invalid_webhook", validation.error || "invalid webhook", 401);
  }

  // Awaited: CardCom's parseCallback is async (re-fetches the authoritative
  // result via GetLpResult). Grow's is sync - await passes its value through.
  const parsed = await provider.parseCallback(body);

  const result = await finalizeProviderCallback({
    tenant,
    providerType,
    provider,
    parsed,
  });

  // Always 200 so the provider stops retrying - rejections are logged inside
  // finalizeProviderCallback for ops to investigate.
  return apiJson({
    received: true,
    matched: result.matched,
    ...(result.kind === "kiosk" ? { kiosk: true } : {}),
    ...(result.error ? { error: result.error } : {}),
    status: result.status,
  });
});
