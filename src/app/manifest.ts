import type { MetadataRoute } from "next";
import { SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

// Web App Manifest — installability + richer mobile/search presence. Icons and
// theme mirror the otterfund brand (warm canvas, coral otter mark).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} · Budgeting, in balance`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ec",
    theme_color: "#f5f3ec",
    categories: ["finance", "productivity", "business"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
