/* XYZ Crypto service worker - PWA (installable + offline) and Web Push.
 *
 * Caching strategy is deliberately conservative so the app stays fresh:
 *  - Navigations: NEVER cached. Straight to the network, /offline.html if that
 *    fails. See the note below - this is the fix for the blank-page reports.
 *  - Hashed static assets (/_next/static, fonts): cache-first (immutable).
 *  - Everything else (APIs, auth, real-time): straight to the network, never cached.
 *
 * ## Why navigations are no longer cached
 *
 * They used to be, network-first with the cached copy as a fallback. The
 * fallback is the problem: an HTML shell names the exact hashed chunks of the
 * deploy that produced it, and those filenames are gone after the next deploy.
 * So a cached shell served on a flaky connection asks for chunks that 404,
 * the 404 comes back as HTML, the browser refuses to execute it on a MIME
 * mismatch, hydration silently never finishes - and the page is blank or frozen
 * with no error the user can see. That is the "website kabhi kabhi blank ho
 * jata hai" report, and it is intermittent by construction: it needs a cached
 * shell AND a deploy since it was cached AND a network hiccup.
 *
 * The previous mitigation was "bump CACHE on any deploy that could strand users
 * on old JS" (CLAUDE.md) plus a one-shot reload in PwaSetup. Both are real, and
 * both are patches on a ritual: the version was last bumped in #140 and six
 * deploys shipped over it in a single day. Not caching HTML at all removes the
 * class of bug instead of asking every future change to remember. The cost is
 * that a previously-visited page no longer renders offline - /offline.html
 * still does - which for a live market/chat app is the right trade.
 */
const CACHE = "xyz-pwa-v7";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || /\.(?:js|css|woff2?|ttf|otf)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin (CDNs/APIs) alone

  // Never cache APIs, data, or the worker itself - always live.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/data/") || url.pathname === "/sw.js") {
    return;
  }

  // App navigations: network only, with the offline page if the network is
  // genuinely gone. Deliberately NOT cached - see the header note.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Immutable static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
      )
    );
  }
});

/* ---- Web Push (dormant unless the user opts into alerts) ---- */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "XYZ Crypto";
  const options = {
    body: data.body || "",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/news" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/news";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && "focus" in w) return w.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
