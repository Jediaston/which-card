const CACHE = "household-meds-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./schedule.js",
  "./store.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(CORE_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        cache.put(event.request, response.clone());
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw new Error("offline");
      }
    })()
  );
});
