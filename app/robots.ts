import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private surfaces - never useful to Google and risk leaking
        // half-finished UI / API responses if indexed.
        //
        // Note /ads/* and /dev are deliberately NOT here: they send a
        // `noindex` header instead. A disallowed page can't be crawled, so
        // Google never reads the noindex and an already-indexed URL would
        // linger. Disallow hides pages; noindex removes them.
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
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
