"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

// Fired by Chromium browsers when the app is installable.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "xyz-pwa-install-dismissed";
const RELOADED_KEY = "xyz-chunk-reload-once";

/**
 * Registers the service worker (makes the site installable + offline) and shows
 * a subtle, dismissible "Install app" pill when the browser reports the app can
 * be installed. Mounted once in the root layout. No-ops where unsupported.
 */
export function PwaSetup() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  // Register the service worker on load, then proactively re-check for a
  // newer version whenever the tab regains focus - browsers only check for SW
  // updates on navigation by default, so a tab left open across a deploy can
  // otherwise sit on a stale worker/cache far longer than necessary.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    let reg: ServiceWorkerRegistration | undefined;
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((r) => { reg = r; })
        .catch(() => {});
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    const onVisible = () => {
      if (document.visibilityState === "visible") reg?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("load", onLoad);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Safety net: if a stale cached page ends up referencing a JS chunk that no
  // longer exists on the current deployment (the classic symptom is the page
  // looking "frozen" - no animations, no live data, because hydration silently
  // never finished), force one hard reload to pick up the current deployment.
  // Guarded with sessionStorage so a genuinely broken chunk can't reload-loop.
  useEffect(() => {
    const isChunkError = (message: string) =>
      /ChunkLoadError|Loading chunk [\d]+ failed|failed to fetch dynamically imported module/i.test(message);
    const reloadOnce = () => {
      try {
        if (sessionStorage.getItem(RELOADED_KEY)) return;
        sessionStorage.setItem(RELOADED_KEY, "1");
      } catch {
        /* ignore */
      }
      window.location.reload();
    };
    // Resource load failures (a <script src> 404, e.g. a stale HTML shell
    // pointing at a chunk hash that no longer exists) fire a plain Event on
    // the failing element - they only reach a window listener registered on
    // the CAPTURE phase, never the bubble phase, and never carry a `message`.
    // Thrown errors (e.g. a dynamic import()'s ChunkLoadError) go through the
    // same listener as a bubbling ErrorEvent with a message instead.
    const onError = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLScriptElement && target.src.includes("/_next/static/")) {
        reloadOnce();
        return;
      }
      const message = (e as ErrorEvent).message;
      if (message && isChunkError(message)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const message = e.reason?.message || String(e.reason || "");
      if (isChunkError(message)) reloadOnce();
    };
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  // Capture the install prompt (Android / desktop Chrome/Edge).
  useEffect(() => {
    const dismissed = (() => { try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; } })();
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (dismissed || standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    setShow(false);
  }

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-3 bottom-[4.75rem] z-[60] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-gold-500/25 bg-ink-900/95 p-3 shadow-elevate backdrop-blur sm:left-4 sm:right-auto md:bottom-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-100">Install XYZ Crypto</p>
        <p className="truncate text-[11px] text-zinc-500">Add to your home screen - fast, app-like, works offline.</p>
      </div>
      <button onClick={install} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-gold-500/40 bg-gold-500/15 px-3 py-2 text-xs font-semibold text-gold-200 transition-colors hover:bg-gold-500/25">
        <Download className="h-3.5 w-3.5" /> Install
      </button>
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 rounded-lg p-1 text-zinc-500 transition-colors hover:text-zinc-200">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
