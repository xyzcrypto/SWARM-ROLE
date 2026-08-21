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
// Bumped v7 -> v8 to EVICT poisoned entries, not as a per-deploy ritual (the
// note above still stands: navigations are not cached, so the old
// bump-on-every-deploy rule is gone). Until now this handler cached whatever
// came back, including 404s. `activate` deletes every cache whose name is not
// this one, so bumping is the only thing that clears a device that already
// stored a broken asset.
//
// v8 -> v9: same reason, different asset. `/logo.png` is precached below at a
// URL that did not change when the artwork did, so every device that already
// installed the SW would keep serving the OLD logo from cache indefinitely -
// the brand change would simply not reach returning visitors or any installed
// PWA. This is an eviction, not a deploy ritual: bump this only when a
// precached URL's CONTENT changes underneath it.
const CACHE = "xyz-pwa-v9";
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
  //
  // ## Two bugs this used to have, and what they looked like
  //
  // The old version was `caches.match(req).then(hit => hit || fetch(req).then(
  // res => { cache.put(req, res.clone()); return res; }))`. Both halves were
  // wrong in ways that only show up on a phone.
  //
  // **It cached failures.** There was no status check, so a 404 - which a
  // hashed asset really can return during the seconds a deploy is propagating
  // across edges - was written to the cache. After that `caches.match` returned
  // that 404 forever, cache-first, for that exact URL. If the 404 was the
  // stylesheet, the page rendered as raw HTML: serif text, blue underlined
  // links, no layout. Permanently, on that device, until site data was cleared.
  // That is the report this fixes.
  //
  // **A network blip killed the request outright.** With no `.catch()`, a
  // rejected fetch rejects `respondWith`, and the browser gets a hard network
  // error - where without a service worker it would have used its own HTTP
  // cache. Intercepting made a flaky connection strictly worse for exactly the
  // files a page cannot render without.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req)
          .then((res) => {
            // Only a real, successful, same-origin response is worth keeping.
            // An error or an opaque response cached here would be served in
            // preference to the network on every later load.
            if (res && res.ok && res.type === "basic") {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() =>
            // The network is gone. Anything cached beats a dead request; if
            // there is nothing, fail the way the browser would have anyway.
            caches.match(req).then((fallback) => fallback || Response.error())
          );
      })
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
      // Already looking at the target - just focus it.
      for (const w of wins) {
        if (w.url.includes(url) && "focus" in w) return w.focus();
      }
      // Otherwise steer an already-open window to the target instead of
      // launching a second copy of the app. This is what makes a DM alert
      // land IN the conversation: its url is /messages?c=<id>, so a phone
      // sitting on any other page would previously have matched nothing and
      // opened a fresh window, losing the deep link on installed PWAs.
      for (const w of wins) {
        if ("navigate" in w && "focus" in w) {
          return Promise.resolve(w.navigate(url))
            .then((c) => (c || w).focus())
            .catch(() => w.focus());
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
