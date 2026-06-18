import { resolveTenantBySlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const THEME_COLOR_BY_ID: Record<string, string> = {
  fresh: "#10b981",
  basil: "#15803d",
  forest: "#064e3b",
  olive: "#65a30d",
  tomato: "#dc2626",
  charcoal: "#1f2937",
  cobalt: "#1d4ed8",
  sunflower: "#f59e0b",
  apricot: "#f9af72",
};

/**
 * Per-tenant PWA manifest for the kiosk. When the merchant adds the
 * kiosk URL to their tablet's home screen, the OS reads this manifest
 * and uses the venue's logo + name + theme color for the installed app
 * shortcut - looks like a dedicated kiosk app, not "QuickFood".
 *
 * start_url + scope are both locked to /s/<slug>/kiosk so the standalone
 * window can never wander into the rest of the storefront.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenantBySlug(tenantSlug);
  if (!tenant || !tenant.kioskEnabled) {
    return new Response("not found", { status: 404 });
  }

  const themeColor = THEME_COLOR_BY_ID[tenant.themeId] ?? "#11231a";
  const icon = tenant.logoUrl ?? "/quickfood-mark.png";
  const kioskPath = `/s/${tenant.slug}/kiosk`;

  const manifest = {
    name: `${tenant.name} · קיוסק`,
    short_name: tenant.name,
    description: `קיוסק להזמנה עצמית - ${tenant.name}`,
    start_url: kioskPath,
    scope: kioskPath,
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: themeColor,
    lang: "he",
    dir: "rtl",
    icons: [
      { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: icon, sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
