"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { isChunkError, reloadWhenReachable } from "@shared/utils/recover";

// Fired by Chromium browsers when the app is installable.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "xyz-pwa-install-dismissed";

/**
 * Registers the service worker (makes the site installable + offline) and shows
 * a subtle, dismissible "Install app" pill when the browser reports the app can
 * be installed. Mounted once in the root layout. No-ops where unsupported.
 */
export function PwaSetup() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  // Mark the document as hydrated. Until this is set, globals.css shows any
  // <Reveal> content after 2.5s on its own, so a page whose JS is slow or
  // failed to load is never left with its text and buttons invisible.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
  }, []);

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
  // Time-guarded so a genuinely broken chunk can't reload-loop.
  useEffect(() => {
    // At most one automatic reload per 30s (see shared/utils/recover.ts): it
    // used to be once per SESSION, so a tab that lived through a second deploy
    // was never recovered and stayed frozen until a manual refresh.
    // Reloads only once the network answers (see reloadWhenReachable): a chunk
    // that failed because the connection dropped must not reload the tab into
    // the browser's offline error page.
    const reloadOnce = (src?: string) => reloadWhenReachable(src);
    // Resource load failures (a <script src> 404, e.g. a stale HTML shell
    // pointing at a chunk hash that no longer exists) fire a plain Event on
    // the failing element - they only reach a window listener registered on
    // the CAPTURE phase, never the bubble phase, and never carry a `message`.
    // Thrown errors (e.g. a dynamic import()'s ChunkLoadError) go through the
    // same listener as a bubbling ErrorEvent with a message instead.
    const onError = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLScriptElement && target.src.includes("/_next/static/")) {
        reloadOnce(target.src);
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
    const onInstalled = () => setShow(false);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
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
      {/* The 192px app icon rather than the 512px master. A raw <img> gets no
          next/image resizing, so `width={40}` only scaled the box - the browser
          still fetched and decoded all 338 KB of a 512x512 RGBA PNG to paint a
          40px square. This is also the icon the installed app will actually
          use, so the prompt now previews the real thing. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-app-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 object-contain" />
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
