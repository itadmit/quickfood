/**
 * Canonical storefront URL for SEO. When the tenant has a live (active)
 * custom domain, that domain is the single primary address - so the canonical
 * points at the clean custom-domain URL (Shopify-style). Otherwise it falls
 * back to the platform path `/s/{slug}` (relative - resolves via metadataBase).
 *
 * `tail` is whatever comes after the slug: "" for the store home, "/menu",
 * or a query like "?item=abc".
 */
export function storefrontCanonical(
  tenant: { slug: string; customDomain: string | null; customDomainStatus: string },
  tail = "",
): string {
  if (tenant.customDomain && tenant.customDomainStatus === "active") {
    const clean = tail.startsWith("?") ? `/${tail}` : tail || "/";
    return `https://${tenant.customDomain}${clean}`;
  }
  return `/s/${tenant.slug}${tail}`;
}
