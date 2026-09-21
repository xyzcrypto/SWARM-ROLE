"use client";

import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Paint a branded "building your card" screen into a just-opened blank tab.
 *
 * A fresh `about:blank` window is same-origin, so we can write to its document
 * directly. Everything is set through DOM properties instead of an HTML string
 * with an inline <style>, because inline styles are exactly what a strict
 * `style-src` blocks - and a placeholder that the CSP silently drops is worse
 * than none, since it leaves the blank page it was meant to replace.
 */
function showPlaceholder(win: Window) {
  try {
    const doc = win.document;
    doc.title = "Building your card - XYZ Crypto";
    const body = doc.body;
    if (!body) return;
    Object.assign(body.style, {
      margin: "0",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "18px",
      background: "linear-gradient(135deg,#08080a 0%,#0e0e12 55%,#15110a 100%)",
      color: "#fafafa",
      fontFamily: "system-ui, -apple-system, sans-serif",
    } as Partial<CSSStyleDeclaration>);

    const brand = doc.createElement("div");
    brand.textContent = "XYZ Crypto";
    Object.assign(brand.style, {
      fontSize: "28px",
      fontWeight: "800",
      letterSpacing: "-0.02em",
      color: "#e2a72f",
    } as Partial<CSSStyleDeclaration>);

    const label = doc.createElement("div");
    label.textContent = "Building your share card...";
    Object.assign(label.style, { fontSize: "15px", color: "#a1a1aa" } as Partial<CSSStyleDeclaration>);

    // A CSS keyframe spinner would need a <style> element; a pulsing dot row
    // driven by Web Animations does the same job with no stylesheet at all.
    const dots = doc.createElement("div");
    Object.assign(dots.style, { display: "flex", gap: "7px" } as Partial<CSSStyleDeclaration>);
    for (let i = 0; i < 3; i++) {
      const dot = doc.createElement("span");
      Object.assign(dot.style, {
        width: "8px",
        height: "8px",
        borderRadius: "999px",
        background: "#e2a72f",
        display: "block",
      } as Partial<CSSStyleDeclaration>);
      dot.animate?.([{ opacity: 0.25 }, { opacity: 1 }, { opacity: 0.25 }], {
        duration: 1100,
        delay: i * 160,
        iterations: Infinity,
      });
      dots.append(dot);
    }

    body.append(brand, label, dots);
  } catch {
    // Cross-origin or a browser that hands back a locked-down window: the tab
    // still navigates when the id arrives, we just lose the placeholder.
  }
}

export type SharePayload = {
  platform: string;
  domain: string;
  sharePct: number;
  tokens: number;
  usd: number;
  fdv: number;
};

/**
 * ⚠️ The payload shape and the `points-value` kind are a WIRE FORMAT, not an
 * implementation detail: `/tools/share/points-value/[id]` and its OpenGraph
 * card render rows that were written months ago. Renaming a field here breaks
 * every card already shared on Twitter, silently and permanently.
 */
export function ShareResultButton({ payload, className }: { payload: () => SharePayload; className?: string }) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function share() {
    if (sharing) return;
    setSharing(true);
    setError(null);
    // Open the tab synchronously, in the same call stack as the click - most
    // browsers (Safari especially) only let window.open() bypass the popup
    // blocker when it's called directly from a user gesture, not after an
    // awaited fetch. We navigate this pre-opened tab once the id comes back.
    //
    // No "noopener" here, deliberately. Per the HTML spec, `noopener` makes
    // window.open() return null - there is no handle to hand back, that is the
    // whole point of it. So `win` was ALWAYS null, the pre-opened tab was
    // orphaned on about:blank (and on mobile it takes focus, so you stare at a
    // blank page), and the code fell through to navigating the original tab
    // behind it - which is why the share card only appeared after going back.
    // The destination is our own same-origin route, so the opener reference
    // noopener would have severed carries no cross-origin risk.
    const win = window.open("", "_blank");
    // The tab exists instantly; the card behind it does not. Creating the share
    // row is a DB write, then the card page itself is a fresh document load -
    // a real second or more of nothing, and on mobile the new tab has already
    // taken focus, so the whole wait is spent staring at a blank white page,
    // which reads as "it broke". The placeholder costs nothing and covers it.
    if (win) showPlaceholder(win);
    try {
      const res = await fetch("/api/tools/share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "points-value", data: payload() }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.id) {
        const url = `/tools/share/points-value/${j.id}`;
        if (win) win.location.href = url;
        else window.location.href = url; // popup fully blocked - fall back to same-tab
      } else {
        win?.close();
        setError("Couldn't create the share link. Please try again.");
      }
    } catch {
      win?.close();
      setError("Couldn't create the share link. Please try again.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-end gap-1.5", className)}>
      <button
        type="button"
        onClick={share}
        disabled={sharing}
        className="btn-secondary inline-flex items-center gap-1.5 text-xs disabled:opacity-60"
      >
        {sharing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
        {sharing ? "Creating link…" : "Share result"}
      </button>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}
