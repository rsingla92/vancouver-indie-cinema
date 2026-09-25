import type { MetadataRoute } from "next";
import { withBase } from "@/lib/base-path";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: withBase("/"),
    name: "IndieScreen Vancouver",
    short_name: "IndieScreen",
    description: "Vancouver independent cinema showtimes",
    start_url: withBase("/"),
    scope: withBase("/"),
    display: "standalone",
    background_color: "#f5f0e4",
    theme_color: "#f5f0e4",
    orientation: "portrait",
    categories: ["entertainment"],
    icons: [
      { src: withBase("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBase("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBase("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: withBase("/icon.svg"), sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
