// Limpia caches heredados y evita que versiones viejas oculten datos actuales.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        clients.forEach((client) => client.navigate(client.url));
      })
      .then(() => self.registration.unregister())
  );
});

self.addEventListener("fetch", () => {});
