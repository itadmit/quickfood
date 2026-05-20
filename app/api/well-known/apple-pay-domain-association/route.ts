/**
 * Apple Pay domain-association file.
 *
 * URL exposed to Apple's verification crawler:
 *   GET /.well-known/apple-developer-merchantid-domain-association
 *
 * That URL is rewritten to this handler by next.config.ts. The handler picks
 * the right file content based on the request's Host header:
 *
 *  - If a tenant has Tenant.customDomain == host AND has a non-null
 *    PaymentProviderConfig.applePayDomainAssociation for grow → return that.
 *    (Used when a restaurant runs on its own domain and registered it with
 *    Grow independently.)
 *
 *  - Otherwise the host is the platform domain — return the env-var content
 *    APPLE_PAY_DOMAIN_ASSOCIATION_PROD (production) or _DEV (preview/dev).
 *
 * If nothing is configured, return 404 so Apple sees an honest answer.
 */

import { prisma } from "@/lib/db/client";
import { PaymentProvider } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRequestHost(req: Request): string | null {
  // Vercel sets x-forwarded-host; fall back to host
  return (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    null
  );
}

export async function GET(req: Request): Promise<Response> {
  const host = getRequestHost(req)?.toLowerCase().split(":")[0] ?? null;

  // Step 1 — per-tenant override (custom domain)
  if (host) {
    const tenant = await prisma.tenant.findFirst({
      where: { customDomain: host },
      select: { id: true },
    });
    if (tenant) {
      const cfg = await prisma.paymentProviderConfig.findUnique({
        where: { tenantId_provider: { tenantId: tenant.id, provider: PaymentProvider.grow } },
        select: { applePayDomainAssociation: true },
      });
      if (cfg?.applePayDomainAssociation) {
        return new Response(cfg.applePayDomainAssociation, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      }
      // Tenant matched a custom domain but hasn't uploaded their file yet.
      return new Response("Apple Pay not configured for this domain", { status: 404 });
    }
  }

  // Step 2 — platform domain fallback (env)
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";

  const content = isProd
    ? process.env.APPLE_PAY_DOMAIN_ASSOCIATION_PROD
    : process.env.APPLE_PAY_DOMAIN_ASSOCIATION_DEV;

  if (!content) {
    return new Response("Apple Pay domain association not configured", { status: 404 });
  }

  return new Response(content, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
