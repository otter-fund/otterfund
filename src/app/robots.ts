import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Crawl the marketing surface; keep private/authed app areas and API routes out
// of the index. Points crawlers at the generated sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/onboarding",
        "/settings",
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/verify-email",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
