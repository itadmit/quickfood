/**
 * Canonical public origin, no trailing slash. Everything SEO-facing derives
 * from this single value - sitemap, robots, canonicals and the JSON-LD @ids
 * must agree exactly, or Google treats them as different pages.
 */
export const SITE_URL = "https://quickfood.co.il";

/** Stable JSON-LD node ids, so any page can reference the Organization by @id. */
export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export function absoluteUrl(path: string): string {
  return path.startsWith("http")
    ? path
    : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
