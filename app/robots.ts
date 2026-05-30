import type { MetadataRoute } from "next";

const BASE = "https://quickfood.co.il";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private surfaces — never useful to Google and risk leaking
        // half-finished UI / API responses if indexed.
        disallow: [
          "/api/",
          "/dashboard/",
          "/admin/",
          "/_next/",
          "/courier/",
          "/pay/",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
