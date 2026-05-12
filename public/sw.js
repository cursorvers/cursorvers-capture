const SHELL = "app-shell-v1";

self.addEventListener("install", (ev) => {
  ev.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
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
