"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, SlidersHorizontal, Check } from "lucide-react";
import { CATEGORIES } from "@/lib/news";
import { cn } from "@/lib/utils";
import { useClientFlag } from "@/lib/useClientFlag";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

type Mode = "high" | "foryou" | "categories" | "off";
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "high", label: "All big news", hint: "Every high-impact story" },
  { id: "foryou", label: "For You", hint: "Only your chosen interests" },
  { id: "categories", label: "Pick topics", hint: "Only the topics you select" },
  { id: "off", label: "Off", hint: "Stay subscribed, no alerts" },
];

// VAPID public key (base64url) → Uint8Array for applicationServerKey.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// "Enable alerts" toggle - registers the service worker, subscribes to Web Push,
// and stores the subscription server-side. Only renders when push is configured
// (a VAPID public key is present) and the browser supports it. With `showPrefs`
// (the News page) it also exposes per-topic notification customization.
export function NewsAlertsToggle({
  loggedIn,
  title = "Get a push notification for major crypto events",
  compact = false,
  showPrefs = false,
}: {
  loggedIn: boolean;
  /** Tooltip copy - lets the same toggle read right on News vs the chat. */
  title?: string;
  /** Icon-only, smaller - fits a dense header row like the chat. */
  compact?: boolean;
  /** Show the "customize which topics" popover (News page). */
  showPrefs?: boolean;
}) {
  // Push needs a service worker, the Push API, and a configured VAPID key.
  const supported = useClientFlag(() => "serviceWorker" in navigator && "PushManager" in window && !!VAPID);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("high");
  const [cats, setCats] = useState<string[]>([]);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Read this device's saved preference (mode + topics) for the popover.
  const loadPrefs = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;
      const r = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      if (j) {
        setMode((j.notifyMode as Mode) ?? "high");
        setCats(Array.isArray(j.notifyCategories) ? j.notifyCategories : []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setEnabled(!!sub);
        if (sub && showPrefs) loadPrefs();
      })
      .catch(() => {});
  }, [supported, showPrefs, loadPrefs]);

  if (!supported || !loggedIn) return null;

  async function subscribeBrowser(): Promise<PushSubscription | null> {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { setMsg("Notifications are blocked. Allow them for this site, then try again."); return null; }
    let reg: ServiceWorkerRegistration;
    try { reg = await navigator.serviceWorker.register("/sw.js"); await navigator.serviceWorker.ready; }
    catch { setMsg("Couldn't start the notifications worker. Please refresh and try again."); return null; }
    try {
      return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource });
    } catch { setMsg("Your browser refused the subscription. The alert key may be misconfigured."); return null; }
  }

  // POST the subscription (+ optional prefs) to the server.
  async function save(sub: PushSubscription, prefs?: { notifyMode: Mode; notifyCategories: string[] }): Promise<boolean> {
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    const res = await fetch("/api/push/subscribe", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: { endpoint: json.endpoint, keys: json.keys }, ...(prefs ?? {}) }),
    });
    if (!res.ok) {
      if (res.status === 401) setMsg("Please log in, then enable alerts.");
      else if (res.status === 503) setMsg("Push isn't configured on the server yet (VAPID key missing).");
      else setMsg(`Couldn't save (error ${res.status}). Please try again.`);
      return false;
    }
    return true;
  }

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      const sub = await subscribeBrowser();
      if (!sub) return;
      const okSaved = await save(sub);
      if (!okSaved) { await sub.unsubscribe().catch(() => {}); return; }
      setEnabled(true);
      if (showPrefs) { setPrefsOpen(true); loadPrefs(); }
    } catch { setMsg("Couldn't enable alerts. Please try again."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMsg(null); setPrefsOpen(false);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setEnabled(false);
    } finally { setBusy(false); }
  }

  async function savePrefs(nextMode: Mode, nextCats: string[]) {
    setSavingPrefs(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await save(sub, { notifyMode: nextMode, notifyCategories: nextCats });
    } catch { /* ignore */ }
    finally { setSavingPrefs(false); }
  }

  const setModeAndSave = (m: Mode) => { setMode(m); savePrefs(m, cats); };
  const toggleCat = (c: string) => {
    const next = cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c];
    setCats(next);
    if (mode === "categories") savePrefs("categories", next);
  };

  return (
    <div className="relative">
      <div className="inline-flex items-center gap-1">
        <button
          onClick={enabled ? disable : enable}
          disabled={busy}
          title={title}
          aria-label={enabled ? "Turn off alerts" : "Turn on alerts"}
          className={cn(
            "inline-flex items-center justify-center rounded-xl border font-medium transition-colors disabled:opacity-60",
            compact ? "gap-0 px-2 py-2 text-xs" : "gap-1.5 px-3 py-2.5 text-sm",
            enabled ? "border-mint-500/40 bg-mint-500/15 text-mint-200 dark:text-mint-200" : "border-white/10 text-zinc-400 hover:text-zinc-100"
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          {!compact && <span className="ml-1.5 hidden sm:inline">{enabled ? "Alerts on" : "Alerts"}</span>}
        </button>
        {showPrefs && enabled && (
          <button
            onClick={() => { setPrefsOpen((v) => !v); if (!prefsOpen) loadPrefs(); }}
            title="Customize which news alerts you get"
            aria-label="Notification settings"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-xl border transition-colors",
              prefsOpen ? "border-gold-500/40 text-gold-200" : "border-white/10 text-zinc-400 hover:text-zinc-100"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>

      {showPrefs && prefsOpen && (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-label="Close" onClick={() => setPrefsOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-[min(92vw,20rem)] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-elevate dark:border-white/10 dark:bg-ink-900">
            <div className="border-b border-black/5 px-4 py-2.5 dark:border-white/10">
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">News alerts {savingPrefs && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}</p>
              <p className="text-[0.6875rem] text-zinc-500">Choose what gets pushed to your device.</p>
            </div>
            <div className="p-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModeAndSave(m.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    mode === m.id ? "bg-mint-500/10" : "hover:bg-black/[0.04] dark:hover:bg-white/5"
                  )}
                >
                  <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border", mode === m.id ? "border-mint-500 bg-mint-500 text-white" : "border-zinc-400")}>
                    {mode === m.id && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.8125rem] font-medium text-zinc-800 dark:text-zinc-100">{m.label}</span>
                    <span className="block text-[0.6875rem] text-zinc-500">{m.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {mode === "categories" && (
              <div className="max-h-44 overflow-y-auto border-t border-black/5 p-2 dark:border-white/10">
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => {
                    const on = cats.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => toggleCat(c)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors",
                          on ? "border-mint-500/50 bg-mint-500/15 text-mint-600 dark:text-mint-200" : "border-black/10 text-zinc-500 hover:text-zinc-800 dark:border-white/10 dark:hover:text-zinc-200"
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
                {cats.length === 0 && <p className="mt-2 px-1 text-[0.6875rem] text-amber-500">Pick at least one topic to get alerts.</p>}
              </div>
            )}
          </div>
        </>
      )}
      {/* Centered under the trigger (not right-anchored) + viewport-clamped width:
          this toggle can sit anywhere in a flex row (e.g. mid-row in ChatClient's
          header, with siblings to its right), so `right-0` anchored to the wrong
          edge and pushed this off the left edge of the screen on mobile - the
          same class of bug already fixed for NavActivity's dropdown. */}
      {msg && <p className="absolute left-1/2 top-full z-50 mt-1 w-56 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded-lg bg-ink-900 p-2 text-[0.6875rem] text-amber-300 shadow-elevate ring-1 ring-white/10">{msg}</p>}
    </div>
  );
}
