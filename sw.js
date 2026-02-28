// sw.js — 5D PWA
// Bump CACHE_NAME every deploy
const CACHE_NAME = "5d-cache-v16";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

// Install: pre-cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Use { cache: "reload" } to bypass HTTP cache when precaching
    await cache.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" })));
  })());
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Fetch strategy:
// - ALWAYS network-first for manifest + icons (so updates show up)
// - Cache-first for everything else same-origin
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname.toLowerCase();

  const isIcon =
    pathname.endsWith("/manifest.json") ||
    pathname.includes("/icons/") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico");

  if (isIcon) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match(req);
        return cached || Response.error();
      }
    })());
    return;
  }

  // Cache-first for app shell
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    if (res && res.status === 200 && res.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
