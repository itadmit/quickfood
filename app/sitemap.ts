import type { MetadataRoute } from "next";

const BASE = "https://quickfood.co.il";

export default function sitemap(): MetadataRoute.Sitemap {
  // Static marketing surface only - tenant storefronts and admin pages
  // are crawled (or blocked) elsewhere. Updating dates by hand keeps the
  // sitemap stable across deploys; bump them when the page meaningfully
  // changes.
  const updated = new Date("2026-05-30");
  return [
    { url: `${BASE}/`, lastModified: updated, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/signup`, lastModified: updated, changeFrequency: "monthly", priority: 0.95 },
    { url: `${BASE}/about`, lastModified: updated, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: updated, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/blog`, lastModified: updated, changeFrequency: "weekly", priority: 0.6 },
    { url: `${BASE}/careers`, lastModified: updated, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/terms`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/sla`, lastModified: updated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/docs/pos`, lastModified: updated, changeFrequency: "monthly", priority: 0.5 },
  ];
}
