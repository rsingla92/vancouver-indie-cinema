import type { NextConfig } from "next";

// Read here rather than imported from lib/base-path so the config stays dependency-free.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// The site is a static export: every page and JSON file is produced at build
// time from the database and published to GitHub Pages.
const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
