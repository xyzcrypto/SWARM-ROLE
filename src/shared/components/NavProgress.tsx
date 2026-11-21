"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

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

// Router requests in flight. A Next soft navigation fetches the new page's RSC
// payload (header `RSC: 1`); counting those lets the fallback tell "the
// router is still waiting for the server" from "a click handler cancelled the
// navigation on purpose" (nothing in flight: leave it alone).
let rscPending = 0;
let fetchPatched = false;
function trackRouterFetches() {
  if (fetchPatched || typeof window === "undefined") return;
  fetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const h = init?.headers;
    const isRsc =
      (h instanceof Headers ? h.get("rsc") : h && !Array.isArray(h) ? (h as Record<string, string>)["rsc"] ?? (h as Record<string, string>)["RSC"] : null) === "1" ||
      (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).includes("_rsc=");
    if (!isRsc) return orig(input, init);
    rscPending++;
    return orig(input, init).finally(() => {
      rscPending = Math.max(0, rscPending - 1);
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
    const start = (path: string, href: string) => {
      const el = bar.current;
      if (!el) return;
      finish();
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
        const stillWaiting = state.current.target === path && window.location.pathname !== path && rscPending > 0;
        finish();
        if (stillWaiting && navigator.onLine !== false) window.location.assign(href);
      }, STUCK_MS);
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
      finish();
    };
  }, []);

  return <div ref={bar} aria-hidden className="nav-progress" data-on="0" />;
}
