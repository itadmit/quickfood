import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/client";
import { isStorefrontBlocked } from "@/lib/tenant-billing";
import { POSTS, postModified } from "@/lib/blog";
import { SITE_URL } from "@/lib/site";

// Cached like any Route Handler, but re-generated hourly so a newly live store
// or a new post shows up without waiting for the next deploy.
export const revalidate = 3600;

/** Marketing surface. Campaign LPs (/ads/*) and /dev are noindex by design. */
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
  lastModified: string;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1, lastModified: "2026-09-27" },
  { path: "/signup", changeFrequency: "monthly", priority: 0.95, lastModified: "2026-09-27" },
  { path: "/solutions/pizzeria", changeFrequency: "monthly", priority: 0.9, lastModified: "2026-09-27" },
  { path: "/solutions/restaurant", changeFrequency: "monthly", priority: 0.9, lastModified: "2026-09-27" },
  { path: "/solutions/cafe", changeFrequency: "monthly", priority: 0.9, lastModified: "2026-09-27" },
  { path: "/solutions/delivery-commissions", changeFrequency: "monthly", priority: 0.85, lastModified: "2026-09-27" },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7, lastModified: "2026-09-27" },
  { path: "/wolt", changeFrequency: "monthly", priority: 0.7, lastModified: "2026-09-27" },
  { path: "/about", changeFrequency: "monthly", priority: 0.6, lastModified: "2026-05-30" },
  { path: "/contact", changeFrequency: "monthly", priority: 0.6, lastModified: "2026-05-30" },
  { path: "/download", changeFrequency: "monthly", priority: 0.5, lastModified: "2026-05-30" },
  { path: "/docs/pos", changeFrequency: "monthly", priority: 0.5, lastModified: "2026-05-30" },
  { path: "/careers", changeFrequency: "monthly", priority: 0.4, lastModified: "2026-05-30" },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3, lastModified: "2026-05-30" },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3, lastModified: "2026-05-30" },
  { path: "/sla", changeFrequency: "yearly", priority: 0.3, lastModified: "2026-05-30" },
];

/**
 * Storefronts worth crawling: live stores that we actually serve from this
 * origin.
 *
 * Two exclusions matter. Blocked stores (suspended / lapsed trial) already
 * send `noindex` from the storefront layout - listing them here would ask
 * Google to crawl pages we then tell it to drop. Stores on a live custom
 * domain canonicalise to that domain, so listing the `/s/{slug}` copy here
 * points Google at a URL that disowns itself; those belong in a sitemap on
 * their own host.
 */
async function storefrontEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        slug: true,
        updatedAt: true,
        status: true,
        trialEndsAt: true,
        billingSuspendedAt: true,
        billingSetupCompletedAt: true,
        customDomain: true,
        customDomainStatus: true,
      },
    });

    return tenants
      .filter((t) => !isStorefrontBlocked(t))
      .filter((t) => !(t.customDomain && t.customDomainStatus === "active"))
      .map((t) => ({
        url: `${SITE_URL}/s/${t.slug}`,
        lastModified: t.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));
  } catch (err) {
    // A sitemap missing its storefronts is a bad day; a failed deploy because
    // Neon was unreachable is a worse one. Serve the marketing surface and
    // let the hourly revalidate pick the stores up.
    console.error("[sitemap] storefront query failed", err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stores = await storefrontEntries();

  return [
    ...STATIC_ROUTES.map((r) => ({
      url: `${SITE_URL}${r.path === "/" ? "" : r.path}`,
      lastModified: new Date(r.lastModified),
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    ...POSTS.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: new Date(postModified(post)),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    ...stores,
  ];
}
