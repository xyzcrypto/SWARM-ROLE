"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { installFetchGuard } from "@shared/utils/fetch-guard";

// Installed at module load, before any component's effects fire their first
// request: every same-origin /api/ call without its own signal gets a timeout.
if (typeof window !== "undefined") installFetchGuard();

/**
 * A thin gold bar at the top of the screen from the moment an internal link
 * is clicked until the new page is on screen.
 *
 * Without it a click on a page that renders on the server (a lesson, a
 * profile, the dashboard) did nothing visible until the server answered,
 * which reads as "the site is stuck" and makes people click again or
 * refresh. The bar answers the click instantly. It never blocks anything,
 * renders no React state (it writes styles directly).
 *
 * If the soft navigation has still not landed after STUCK_MS (a cold function
 * that never answered, a router request lost on a flaky connection), the
 * click is finished as a normal full page load. That is exactly what the
 * owner was doing by hand ("it gets stuck, I have to refresh"), done for them.
 */
const STUCK_MS = 10_000;
/**
 * On a genuinely slow connection a healthy page can take longer than 10s, and
 * turning it into a full reload then makes things worse: the reload is the
 * heavier request. Give 2G/3G-class connections (as the browser reports them)
 * more time before deciding the navigation is stuck.
 */
const SLOW_STUCK_MS = 25_000;
export function stuckAfter(conn?: { effectiveType?: string; downlink?: number; saveData?: boolean } | null): number {
  if (!conn) return STUCK_MS;
  const slow = conn.saveData || /(^|-)2g$|^3g$/.test(conn.effectiveType ?? "") || (typeof conn.downlink === "number" && conn.downlink > 0 && conn.downlink < 1.5);
  return slow ? SLOW_STUCK_MS : STUCK_MS;
}
const stuckMs = () => stuckAfter((navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; saveData?: boolean } }).connection);

// Router page requests. A Next soft navigation fetches the new page's RSC
// payload (header `RSC: 1`). Knowing the router actually STARTED loading the
// clicked page lets the fallback tell "the router tried and the page never
// arrived" from "a click handler cancelled the navigation on purpose" (no
// request for that page: leave it alone).
let fetchPatched = false;
/** When the router last started loading each path. */
const navStartedAt = new Map<string, number>();

/** A soft navigation's RSC request still in flight: where it goes and when it started. */
type PendingNav = { href: string; path: string; at: number };
const pendingNavs = new Set<PendingNav>();

function header(h: HeadersInit | undefined, name: string): string | null {
  if (!h) return null;
  if (h instanceof Headers) return h.get(name);
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name)?.[1] ?? null;
  const rec = h as Record<string, string>;
  for (const k in rec) if (k.toLowerCase() === name) return rec[k];
  return null;
}

/**
 * Pure, for tests: is this fetch the router loading a page (not a prefetch,
 * not a server action), and if so which URL would a hard load use?
 */
export function navTarget(url: string, init: RequestInit | undefined, origin: string): { href: string; path: string } | null {
  const h = init?.headers;
  const rsc = header(h, "rsc") === "1" || url.includes("_rsc=");
  if (!rsc) return null;
  if (header(h, "next-router-prefetch") || header(h, "next-action") || (init?.method && init.method.toUpperCase() !== "GET")) return null;
  let u: URL;
  try {
    u = new URL(url, origin);
  } catch {
    return null;
  }
  if (u.origin !== origin) return null;
  u.searchParams.delete("_rsc");
  return { href: u.pathname + (u.search === "?" ? "" : u.search) + u.hash, path: u.pathname };
}

function trackRouterFetches() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const nav = navTarget(url, init, window.location.origin);
    if (!nav) return orig(input, init);
    const entry = { ...nav, at: Date.now() };
    pendingNavs.add(entry);
    navStartedAt.set(nav.path, entry.at);
    return orig(input, init).finally(() => {
      pendingNavs.delete(entry);
    });
  };
}

export function NavProgress() {
  const bar = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const state = useRef<{ timer: number | null; giveUp: number | null; target: string | null }>({ timer: null, giveUp: null, target: null });

  const finish = () => {
    const el = bar.current;
    const st = state.current;
    if (st.timer) window.clearInterval(st.timer);
    if (st.giveUp) window.clearTimeout(st.giveUp);
    st.timer = st.giveUp = null;
    st.target = null;
    if (!el || el.dataset.on !== "1") return;
    el.style.transform = "scaleX(1)";
    el.style.opacity = "0";
    el.dataset.on = "0";
  };

  // The new route is rendered: complete the bar.
  useEffect(() => {
    finish();
  }, [pathname]);

  useEffect(() => {
    trackRouterFetches();
    // Navigations started from code (router.push from a button, AneQue, the
    // command palette) never pass through the click handler below. Watch the
    // router's own page requests instead: one that has been in flight for
    // STUCK_MS towards a page we are not on is finished as a full load.
    const watchdog = window.setInterval(() => {
      const now = Date.now();
      for (const n of pendingNavs) {
        if (now - n.at < stuckMs()) continue;
        pendingNavs.delete(n);
        if (n.path !== window.location.pathname && navigator.onLine !== false && !document.hidden) {
          window.location.assign(n.href);
          return;
        }
      }
    }, 2000);
    const start = (path: string, href: string) => {
      const el = bar.current;
      if (!el) return;
      finish();
      // A little before the click: the router may start the request in the
      // same tick as this capture-phase listener.
      const clickedAt = Date.now() - 50;
      state.current.target = path;
      el.dataset.on = "1";
      el.style.transition = "none";
      el.style.opacity = "1";
      el.style.transform = "scaleX(0.08)";
      void el.offsetWidth;
      el.style.transition = "transform 0.4s cubic-bezier(0.22,1,0.36,1), opacity 0.35s ease 0.15s";
      let p = 0.08;
      state.current.timer = window.setInterval(() => {
        p += (0.92 - p) * 0.12;
        el.style.transform = `scaleX(${p.toFixed(3)})`;
      }, 250);
      state.current.giveUp = window.setTimeout(() => {
        // The click has not landed after STUCK_MS. It used to also require the
        // RSC request to still be IN FLIGHT, so a navigation that died after
        // its request finished (the route's JS chunk 404ing after a deploy, a
        // render that never resolved) left the page frozen. Now: the router
        // started loading this page and we are still not on it.
        const stillWaiting = state.current.target === path && window.location.pathname !== path && (navStartedAt.get(path) ?? 0) >= clickedAt;
        finish();
        if (stillWaiting && navigator.onLine !== false) window.location.assign(href);
      }, stuckMs());
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return; // same page (hash / query): nothing to wait for
      start(url.pathname, url.href);
    };
    const onPop = () => finish();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      window.clearInterval(watchdog);
      finish();
    };
  }, []);

  return <div ref={bar} aria-hidden className="nav-progress" data-on="0" />;
}
