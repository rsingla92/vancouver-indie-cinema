import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "IndieScreen Vancouver",
    short_name: "IndieScreen",
    description: "Vancouver independent cinema showtimes",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f0e4",
    theme_color: "#f5f0e4",
    orientation: "portrait",
    categories: ["entertainment"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
