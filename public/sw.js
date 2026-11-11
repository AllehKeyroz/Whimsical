const CACHE = "kds-flux-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/", "/index.html", "/manifest.webmanifest", "/icon.svg"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;
  // Runtime config is generated per container; never serve it from cache.
  if (new URL(req.url).pathname === "/env.js") return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put("/index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (req.destination === "script" || req.destination === "style" || req.destination === "font" || req.destination === "image")) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});
