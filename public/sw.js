const SHELL = "app-shell-v8";

self.addEventListener("install", (ev) => {
  ev.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

// SWRegistry からの SKIP_WAITING 要求に応える
self.addEventListener("message", (ev) => {
  if (ev.data && ev.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  const url = new URL(req.url);

  // Cross-origin pass-through (apis.google.com, accounts.google.com 等)
  if (url.origin !== self.location.origin) {
    return;
  }

  if (req.mode === "navigate") {
    ev.respondWith(
      caches.open(SHELL).then((cache) =>
        cache.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              if (res.ok) void cache.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
    return;
  }

  ev.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          void caches.open(SHELL).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.open(SHELL).then((c) => c.match(req))),
  );
});
