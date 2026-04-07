const CACHE_NAME = "jooli-v2.3";

const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/logoB.png",
  "/icon-192.png",
  "/icon-512.png",
  "/css/base.css",
  "/css/layout.css",
  "/css/login.css",
  "/css/events.css",
  "/css/staff.css",
  "/css/checklist.css",
  "/css/modals.css",
  "/js/main.js",
  "/js/auth.js",
  "/js/calendar.js",
  "/js/events.js",
  "/js/staff.js",
  "/js/lista.js",
  "/js/ui.js",
  "/js/events/events-form.js",
  "/js/events/events-render.js",
  "/js/events/events-jornadas.js",
  "/js/events/events-maps.js",
  "/js/events/events-budget.js",
  "/js/events/events-avisos.js",
  "/js/events/events-utils.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  // Solo cachear requests GET, ignorar Firebase y APIs externas
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.hostname.includes("firebase") ||
    url.hostname.includes("gstatic") ||
    url.hostname.includes("googleapis")) return;

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});