"use client";

import { useState } from "react";
import { Link2, Check, ImageDown } from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Post to X + copy link + copy image, for a shared calculator result. Mirrors
// ShareRow.tsx's X-intent/copy-link pattern (used on research posts), plus a
// new copy-image action (no prior precedent - Clipboard API for images).
export function PointsShareActions({ imageUrl, platform, usd }: { imageUrl: string; platform: string; usd: number }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState<"idle" | "copied" | "unsupported">("idle");

  function pageUrl() {
    return typeof window !== "undefined" ? window.location.href : "";
  }

  function shareText() {
    return `My ${platform} points are estimated at $${usd.toLocaleString(undefined, { maximumFractionDigits: 0 })} on XYZ Crypto`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function copyImage() {
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        setCopiedImage("unsupported");
        setTimeout(() => setCopiedImage("idle"), 2200);
        return;
      }
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setCopiedImage("copied");
      setTimeout(() => setCopiedImage("idle"), 1800);
    } catch {
      setCopiedImage("unsupported");
      setTimeout(() => setCopiedImage("idle"), 2200);
    }
  }

  const btn =
    "inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-medium text-zinc-300 transition-all hover:border-gold-500/40 hover:text-gold-100";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href="#"
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
        aria-label="Post to X"
        onClick={(e) => {
          e.currentTarget.href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText())}&url=${encodeURIComponent(pageUrl())}`;
        }}
      >
        <XIcon className="h-3.5 w-3.5" />
        Post to X
      </a>
      <button type="button" onClick={copyLink} className={btn} aria-label="Copy link">
        {copiedLink ? <Check className="h-3.5 w-3.5 text-mint-300" /> : <Link2 className="h-3.5 w-3.5" />}
        {copiedLink ? "Copied" : "Copy link"}
      </button>
      <button type="button" onClick={copyImage} className={btn} aria-label="Copy image">
        {copiedImage === "copied" ? <Check className="h-3.5 w-3.5 text-mint-300" /> : <ImageDown className="h-3.5 w-3.5" />}
        {copiedImage === "copied" ? "Copied" : copiedImage === "unsupported" ? "Open image below" : "Copy image"}
      </button>
    </div>
  );
}
