/**
 * Path prefix the site is served under. Empty for a custom domain or a user site;
 * "/<repo>" for a GitHub Pages project site. Set at build time from the Pages
 * configuration; Next.js applies it to routes and assets, and this helper applies
 * it to the few hand-written URLs (manifest, icons, service worker).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
