"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

// VAPID public key (base64url) → Uint8Array for applicationServerKey.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// "Enable alerts" toggle — registers the service worker, subscribes to Web Push,
// and stores the subscription server-side. Only renders when push is configured
// (a VAPID public key is present) and the browser supports it.
export function NewsAlertsToggle({ loggedIn }: { loggedIn: boolean }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ok = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!VAPID;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, []);

  if (!supported || !loggedIn) return null;

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      // 1) Permission — ask up front so a denial gives a clear message.
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMsg("Notifications are blocked. Allow them for this site in your browser settings, then try again.");
        return;
      }

      // 2) Service worker.
      let reg: ServiceWorkerRegistration;
      try {
        reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
      } catch {
        setMsg("Couldn't start the notifications worker. Please refresh and try again.");
        return;
      }

      // 3) Subscribe with the VAPID key (fails if the key is malformed).
      let sub: PushSubscription;
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID) as BufferSource,
        });
      } catch {
        setMsg("Your browser refused the subscription. The alert key may be misconfigured.");
        return;
      }

      // 4) Store server-side. Surface the real status so config gaps are obvious.
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: { endpoint: json.endpoint, keys: json.keys } }),
      });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        if (res.status === 401) setMsg("Please log in, then enable alerts.");
        else if (res.status === 503) setMsg("Push isn't configured on the server yet (VAPID key missing).");
        else setMsg(`Couldn't save your subscription (error ${res.status}). Please try again.`);
        return;
      }
      setEnabled(true);
    } catch {
      setMsg("Couldn't enable alerts. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={enabled ? disable : enable}
        disabled={busy}
        title="Get a push notification for major crypto events"
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-60",
          enabled ? "border-mint-500/40 bg-mint-500/15 text-mint-200" : "border-white/10 text-zinc-400 hover:text-zinc-100"
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
        <span className="hidden sm:inline">{enabled ? "Alerts on" : "Alerts"}</span>
      </button>
      {msg && <p className="absolute right-0 top-full mt-1 w-56 rounded-lg bg-ink-900 p-2 text-[11px] text-amber-300 shadow-elevate ring-1 ring-white/10">{msg}</p>}
    </div>
  );
}
