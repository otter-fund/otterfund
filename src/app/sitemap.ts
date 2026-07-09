import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

// Public, indexable pages only — the marketing surface. Authed app routes are
// excluded (and disallowed in robots.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: absoluteUrl("/"), lastModified, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/pricing"), lastModified, changeFrequency: "monthly", priority: 0.8 },
  ];
}
