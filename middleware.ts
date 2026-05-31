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
 * Important: this routes on ANY tenant that has a `customDomain` set,
 * regardless of `customDomainStatus`. The "active" flag is administrative
 * — it tells the merchant we've confirmed end-to-end via Vercel. But the
 * domain is added to the Vercel project as soon as the merchant types it,
 * so visits can arrive (and need to route) before they click "verify".
 * If we filter on `active` here, visits during the pending window hit
 * `not-found` — which Vercel's edge CDN will then cache for ~1h, leaving
 * the merchant staring at a 404 long after we flipped them to active.
 *
 * Cache busting: every rewrite response carries `Cache-Control:
 * private, no-store` and `Vary: Host` so the edge cache never holds
 * onto a snapshot of a custom-domain response. Storefront pages are
 * `force-dynamic` anyway, so we don't lose perf — we just lose the
 * 404-staleness footgun.
 *
 * Notes for Next.js 16:
 *   - This file lives at the project root and is named `proxy.ts`
 *     (formerly `middleware.ts`; the convention was renamed in 16).
 *   - Proxy defaults to the Node.js runtime so we can use Prisma directly.
 *   - A `matcher` excludes /api, /_next, static files and the .well-known
 *     namespace so we don't pay the tenant lookup on every asset request.
 */

import { NextResponse, type NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

// Vercel runs middleware in the Edge runtime regardless of the Next.js
// "Node runtime default" docs for proxy.ts, and Prisma Client refuses to
// load there. Neon's HTTP driver is a thin fetch-based SQL client that
// runs everywhere — perfect for the one short SELECT we need on every
// custom-domain request. Falls back to DIRECT_URL when the pooled URL is
// the pgbouncer one (Neon HTTP doesn't work through a pgbouncer port).
const NEON_URL = process.env.NEON_HTTP_URL || process.env.DIRECT_URL || process.env.DATABASE_URL || "";
const sql = NEON_URL ? neon(NEON_URL) : null;

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
// every navigation on a custom domain doesn't hit Postgres. TTL is short
// because a freshly-added domain needs to start routing within seconds —
// merchants are watching the spinner.
type CacheEntry = { slug: string | null; expiresAt: number };
const CACHE_TTL_MS = 10_000;
const hostCache = new Map<string, CacheEntry>();

async function resolveTenantSlug(host: string): Promise<string | null> {
  const cached = hostCache.get(host);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.slug;

  if (!sql) return null;

  // Route on `customDomain` alone — `customDomainStatus` is administrative.
  // The status check used to live here, but it caused 404s during the
  // pending window (between add+verify) that Vercel's edge CDN then cached.
  const rows = (await sql`
    SELECT slug FROM tenants WHERE custom_domain = ${host} LIMIT 1
  `) as Array<{ slug: string }>;
  const slug = rows[0]?.slug ?? null;
  hostCache.set(host, { slug, expiresAt: now + CACHE_TTL_MS });
  return slug;
}

// Stamp every custom-domain response with headers that tell the CDN
// "don't cache this, and if you do, key by Host." A stale 404 cached at
// the edge during the pending window is the #1 thing that breaks the
// "click connect → see the site" demo.
function applyNoCacheHeaders(res: NextResponse): NextResponse {
  res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Vercel-CDN-Cache-Control", "no-store");
  res.headers.set("Vary", "Host");
  return res;
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const host =
    request.headers.get("x-forwarded-host")?.toLowerCase().split(":")[0] ||
    request.headers.get("host")?.toLowerCase().split(":")[0] ||
    "";

  if (isPlatformHost(host)) return NextResponse.next();

  let slug: string | null = null;
  let lookupErr: string | null = null;
  try {
    slug = await resolveTenantSlug(host);
  } catch (e) {
    lookupErr = e instanceof Error ? `${e.name}:${e.message}` : String(e);
  }

  if (!slug) {
    // Custom host pointing at us but no matching tenant. Fall through to
    // the default app — but with no-cache headers so this state doesn't
    // get baked into the CDN. (Otherwise a visit before the merchant
    // adds the domain will poison the edge for an hour.)
    const fallthrough = applyNoCacheHeaders(NextResponse.next());
    // Surface what the proxy saw so we can debug routing without logs.
    // Remove once the custom-domain flow is proven on prod.
    fallthrough.headers.set("x-qf-proxy-host", host);
    fallthrough.headers.set("x-qf-proxy-slug", "null");
    if (lookupErr) fallthrough.headers.set("x-qf-proxy-error", lookupErr.slice(0, 200));
    return fallthrough;
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
  return applyNoCacheHeaders(NextResponse.rewrite(url));
}

export const config = {
  matcher: [
    // Match everything except API routes, Next internals, static assets,
    // well-known files, and the merchant/admin/auth surfaces (which are
    // platform-host only and should never be reached via custom domain).
    "/((?!api|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|\\.well-known|dashboard|admin|login|signup|courier).*)",
  ],
};
