/* Double Bill service worker.
 * - Navigations and JSON data: network first, cached copy when offline.
 * - Hashed Next.js assets: cache first (immutable).
 * - TMDB posters: stale-while-revalidate with a bounded cache.
 * Bump VERSION to drop every old cache on the next activation.
 */
const VERSION = "v4";
const SHELL_CACHE = `doublebill-shell-${VERSION}`;
const DATA_CACHE = `doublebill-data-${VERSION}`;
const IMAGE_CACHE = `doublebill-images-${VERSION}`;
const LIVE_CACHES = new Set([SHELL_CACHE, DATA_CACHE, IMAGE_CACHE]);
// The site may live under a path prefix (a GitHub Pages project site); the worker is served from `${BASE}/sw.js`.
const BASE = new URL(self.location.href).pathname.replace(/\/sw\.js$/, "");
const SHELL = [`${BASE}/`, `${BASE}/manifest.webmanifest`, `${BASE}/icon.svg`, `${BASE}/icon-192.png`];
const IMAGE_HOSTS = new Set(["image.tmdb.org"]);
const MAX_IMAGES = 120;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !LIVE_CACHES.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache, limit) {
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok || response.type === "opaque") {
        await cache.put(request, response.clone());
        if (limit) await trim(cache, limit);
      }
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await refresh) ?? Response.error();
}

const offlineJson = () => new Response(JSON.stringify({ data: [], meta: { offline: true } }), {
  status: 503,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});
const offlinePage = async () => (await caches.match(`${BASE}/`)) ?? new Response("You are offline.", { status: 503, headers: { "content-type": "text/plain" } });

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith(`${BASE}/api/`)) {
      event.respondWith(networkFirst(request, DATA_CACHE).catch(offlineJson));
    } else if (url.pathname.startsWith(`${BASE}/_next/static/`)) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
    } else if (request.mode === "navigate") {
      event.respondWith(networkFirst(request, SHELL_CACHE).catch(offlinePage));
    } else if (SHELL.includes(url.pathname)) {
      event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    }
    return;
  }

  if (IMAGE_HOSTS.has(url.hostname) && request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, MAX_IMAGES));
  }
});
