/**
 * Host-based tenant routing — the "Shopify-style" custom-domain entry point.
 *
 * When a request arrives on a host that is NOT the platform host
 * (quickfood.co.il / *.vercel.app / localhost), look up the tenant whose
 * `customDomain` matches the request host and rewrite the URL transparently
 * to `/s/{tenantSlug}{originalPath}`. From the storefront's perspective the
 * request looks identical to a slug-based visit — no other code needs to
 * change.
 *
 * Notes for Next.js 16:
 *   - This file lives at the project root and is named `proxy.ts`
 *     (formerly `middleware.ts`; the convention was renamed in 16).
 *   - Proxy defaults to the Node.js runtime so we can use Prisma directly.
 *   - A `matcher` excludes /api, /_next, static files and the .well-known
 *     namespace so we don't pay the tenant lookup on every asset request.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";

const PLATFORM_HOST = "quickfood.co.il";

// Hosts that should NEVER be treated as custom domains, even if a tenant
// accidentally registered them. We always serve them directly without a
// tenant lookup.
function isPlatformHost(host: string): boolean {
  if (!host) return true;
  if (host === PLATFORM_HOST) return true;
  if (host.endsWith(`.${PLATFORM_HOST}`)) return true;
  if (host.endsWith(".vercel.app")) return true;
  if (host === "localhost" || host.startsWith("localhost:")) return true;
  if (host === "127.0.0.1" || host.startsWith("127.0.0.1:")) return true;
  // bare IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host)) return true;
  return false;
}

// In-process memo: cache hostname → tenantSlug | null for a short window so
// every navigation on a custom domain doesn't hit Postgres. Entries are
// invalidated by TTL; explicit invalidation happens when the merchant
// removes a domain (writes set status, next lookup misses cache on TTL).
type CacheEntry = { slug: string | null; expiresAt: number };
const CACHE_TTL_MS = 60_000;
const hostCache = new Map<string, CacheEntry>();

async function resolveTenantSlug(host: string): Promise<string | null> {
  const cached = hostCache.get(host);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.slug;

  const tenant = await prisma.tenant.findFirst({
    where: { customDomain: host, customDomainStatus: "active" },
    select: { slug: true },
  });
  const slug = tenant?.slug ?? null;
  hostCache.set(host, { slug, expiresAt: now + CACHE_TTL_MS });
  return slug;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const host =
    request.headers.get("x-forwarded-host")?.toLowerCase().split(":")[0] ||
    request.headers.get("host")?.toLowerCase().split(":")[0] ||
    "";

  if (isPlatformHost(host)) return NextResponse.next();

  const slug = await resolveTenantSlug(host);
  if (!slug) {
    // Unknown host → fall through to the default app. The merchant either
    // pointed their DNS here before adding the domain, or removed it.
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  const path = url.pathname;

  // If the visitor went straight to "/" on their custom domain, send them
  // to the menu. Otherwise prefix the existing path with /s/{slug}.
  const target =
    path === "/" || path === ""
      ? `/s/${slug}/menu`
      : path.startsWith(`/s/${slug}`)
        ? path // already rewritten — passthrough
        : `/s/${slug}${path}`;

  url.pathname = target;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Match everything except API routes, Next internals, static assets,
    // well-known files, and the merchant/admin/auth surfaces (which are
    // platform-host only and should never be reached via custom domain).
    "/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|\\.well-known|dashboard|admin|login|signup|courier).*)",
  ],
};
